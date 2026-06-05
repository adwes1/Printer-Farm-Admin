import { BambuMqttSubscriber } from "./mqttSubscriber.js";
import { createConnectedStatus, createOfflineStatus, mergeBambuStatus, normalizeBambuStatus } from "./normalizer.js";

const OFFLINE_AFTER_MS = 60000;
const DEFAULT_STATUS_FLUSH_INTERVAL_MS = 5000;

function normalizeStatusFlushInterval(value) {
  const interval = Number.parseInt(value, 10);
  return Number.isFinite(interval) ? Math.min(60000, Math.max(1000, interval)) : DEFAULT_STATUS_FLUSH_INTERVAL_MS;
}

function connectionKey(printer) {
  return String(printer.id);
}

function canConnectPrinter(printer) {
  return Boolean(printer?.isActive && printer.ipAddress && printer.serialNumber && printer.accessCode);
}

function printerConnectionChanged(previous, next) {
  return previous.ipAddress !== next.ipAddress ||
    previous.serialNumber !== next.serialNumber ||
    previous.accessCode !== next.accessCode;
}

function cleanPreviewPath(value) {
  const text = String(value || "").replace(/[\r\n]/g, "").trim();
  return text || null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function previewLookupPaths(status = {}) {
  const candidates = [];
  for (const value of [status.currentFile, status.subtaskName]) {
    const path = cleanPreviewPath(value);
    if (!path) {
      continue;
    }
    candidates.push(path);
    if (!/[./\\][^/\\]+$/i.test(path) && !/\.[a-z0-9]+$/i.test(path)) {
      candidates.push(`${path}.3mf`);
    }
  }
  return unique(candidates);
}

function statusLooksActive(status = {}) {
  return ["running", "printing", "pause"].includes(String(status.state || "").toLowerCase()) ||
    (status.progressPercent > 0 && status.progressPercent < 100) ||
    status.remainingMinutes > 0 ||
    status.nozzleTemp > 100 ||
    status.nozzleTargetTemp > 100 ||
    status.bedTemp > 40 ||
    status.bedTargetTemp > 40;
}

export class BambuCollector {
  constructor({ loadPrinters, saveStatus, saveEvent, resolvePreview, broadcast, statusFlushIntervalMs = DEFAULT_STATUS_FLUSH_INTERVAL_MS }) {
    this.loadPrinters = loadPrinters;
    this.saveStatus = saveStatus;
    this.saveEvent = saveEvent;
    this.resolvePreview = resolvePreview;
    this.broadcast = broadcast;
    this.statusFlushIntervalMs = normalizeStatusFlushInterval(statusFlushIntervalMs);
    this.connections = new Map();
    this.refreshTimer = null;
  }

  setStatusFlushIntervalMs(value) {
    this.statusFlushIntervalMs = normalizeStatusFlushInterval(value);
  }

  start() {
    this.refresh().catch((error) => console.error("Bambu Collector start failed:", error.message));
    this.refreshTimer = setInterval(() => {
      this.refresh().catch((error) => console.error("Bambu Collector refresh failed:", error.message));
    }, 30000);
  }

  stop() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    for (const connection of this.connections.values()) {
      connection.subscriber.close();
      clearTimeout(connection.offlineTimer);
      clearTimeout(connection.reconnectTimer);
      clearTimeout(connection.flushTimer);
    }
    this.connections.clear();
  }

  async refresh() {
    const printers = await this.loadPrinters();
    const activeIds = new Set(printers.filter(canConnectPrinter).map((printer) => connectionKey(printer)));

    for (const [key, connection] of this.connections.entries()) {
      if (!activeIds.has(key)) {
        connection.subscriber.close();
        clearTimeout(connection.offlineTimer);
        clearTimeout(connection.reconnectTimer);
        clearTimeout(connection.flushTimer);
        this.connections.delete(key);
      }
    }

    for (const printer of printers) {
      if (!canConnectPrinter(printer)) {
        continue;
      }

      const key = connectionKey(printer);
      const connection = this.connections.get(key);
      if (!connection) {
        this.open(printer);
        continue;
      }

      if (printerConnectionChanged(connection.printer, printer)) {
        connection.subscriber.close();
        clearTimeout(connection.offlineTimer);
        clearTimeout(connection.reconnectTimer);
        clearTimeout(connection.flushTimer);
        this.connections.delete(key);
        this.open(printer);
      } else {
        connection.printer = printer;
      }
    }
  }

  open(printer, attempt = 0) {
    const key = connectionKey(printer);
    const subscriber = new BambuMqttSubscriber({
      host: printer.ipAddress,
      serialNumber: printer.serialNumber,
      accessCode: printer.accessCode
    });
    const connection = {
      printer,
      subscriber,
      attempt,
      offlineTimer: null,
      reconnectTimer: null,
      flushTimer: null,
      hasMessage: false,
      isFlushing: false,
      lastFlushAt: 0,
      lastSnapshotRequestAt: 0,
      pendingStatus: null
    };
    this.connections.set(key, connection);

    subscriber.on("connect", () => {
      console.log(`Bambu MQTT verbunden: ${printer.name} (${printer.ipAddress})`);
      this.saveEvent(printer.id, "mqtt_connected", "MQTT-Verbindung hergestellt", "info").catch(() => {});
      this.saveStatus(printer.id, createConnectedStatus(printer))
        .then(() => {
          this.broadcast({ type: "printer-status", printerId: printer.id });
        })
        .catch((error) => {
          console.warn(`Bambu MQTT Online-Status konnte fuer ${printer.name} nicht gespeichert werden: ${error.message}`);
        });
      this.armOfflineTimer(connection);
    });

    subscriber.on("message", async (_topic, message) => {
      connection.hasMessage = true;
      this.armOfflineTimer(connection);
      let raw;
      try {
        raw = JSON.parse(message);
      } catch (error) {
        console.warn(`Bambu MQTT JSON Parse Fehler bei ${printer.name}: ${error.message}`);
        await this.saveEvent(printer.id, "json_parse_error", error.message, "warn").catch(() => {});
        return;
      }

      const status = normalizeBambuStatus(raw, printer);
      connection.pendingStatus = mergeBambuStatus(connection.pendingStatus, status);
      this.scheduleStatusFlush(connection);
    });

    subscriber.on("subscribed", () => {
      this.requestStatusSnapshot(connection);
    });

    subscriber.on("error", (error) => {
      const authHint = /auth|connect fehlgeschlagen/i.test(error.message) ? "Authentifizierungsfehler" : "Verbindungsfehler";
      console.warn(`Bambu MQTT ${authHint} bei ${printer.name}: ${error.message}`);
      this.saveEvent(printer.id, "mqtt_error", error.message, "warn").catch(() => {});
      subscriber.close();
    });

    subscriber.on("close", () => {
      clearTimeout(connection.offlineTimer);
      clearTimeout(connection.flushTimer);
      if (this.connections.get(key) !== connection) {
        return;
      }
      this.markOffline(connection, "mqtt_closed").catch(() => {});
      this.scheduleReconnect(connection);
    });

    subscriber.connect();
  }

  requestStatusSnapshot(connection) {
    const now = Date.now();
    if (connection.lastSnapshotRequestAt && now - connection.lastSnapshotRequestAt < 60000) {
      return;
    }
    if (connection.subscriber.requestStatusSnapshot()) {
      connection.lastSnapshotRequestAt = now;
    }
  }

  scheduleStatusFlush(connection) {
    if (connection.flushTimer || connection.isFlushing) {
      return;
    }

    const elapsed = Date.now() - connection.lastFlushAt;
    const delay = Math.max(0, this.statusFlushIntervalMs - elapsed);
    connection.flushTimer = setTimeout(() => {
      connection.flushTimer = null;
      this.flushPendingStatus(connection).catch((error) => {
        console.warn(`Bambu MQTT Status konnte fuer ${connection.printer.name} nicht gespeichert werden: ${error.message}`);
      });
    }, delay);
  }

  async flushPendingStatus(connection) {
    if (!connection.pendingStatus || connection.isFlushing) {
      return;
    }

    connection.isFlushing = true;
    const status = connection.pendingStatus;
    connection.pendingStatus = null;

    try {
      const savedStatus = await this.saveStatus(connection.printer.id, status);
      this.maybeResolvePreview(connection, savedStatus || status).catch((error) => {
        console.warn(`Bambu Datei-Cache konnte fuer ${connection.printer.name} nicht gelesen werden: ${error.message}`);
      });
      connection.lastFlushAt = Date.now();
      this.broadcast({ type: "printer-status", printerId: connection.printer.id });
    } finally {
      connection.isFlushing = false;
    }

    if (connection.pendingStatus) {
      this.scheduleStatusFlush(connection);
    }
  }

  async maybeResolvePreview(connection, status) {
    if (!this.resolvePreview || !connection.printer.enableFileCacheLookup || !status.online) {
      return;
    }
    const filePaths = previewLookupPaths(status);
    if (filePaths.length === 0 && !statusLooksActive(status)) {
      return;
    }
    if (filePaths.length === 0) {
      this.requestStatusSnapshot(connection);
    }
    if (connection.previewLookupRunning) {
      return;
    }
    const now = Date.now();
    if (connection.lastPreviewLookupAt && now - connection.lastPreviewLookupAt < 60000) {
      return;
    }
    connection.previewLookupRunning = true;
    try {
      connection.lastPreviewLookupAt = Date.now();
      for (const filePath of filePaths.length ? filePaths : [null]) {
        const updated = await this.resolvePreview(connection.printer, filePath, status);
        if (updated) {
          this.broadcast({ type: "printer-status", printerId: connection.printer.id });
          return;
        }
      }
    } finally {
      connection.previewLookupRunning = false;
    }
  }

  armOfflineTimer(connection) {
    clearTimeout(connection.offlineTimer);
    connection.offlineTimer = setTimeout(() => {
      this.markOffline(connection, "offline_timeout").catch(() => {});
    }, OFFLINE_AFTER_MS);
  }

  async markOffline(connection, eventType) {
    const { printer } = connection;
    connection.pendingStatus = null;
    clearTimeout(connection.flushTimer);
    connection.flushTimer = null;
    await this.saveStatus(printer.id, createOfflineStatus(printer));
    await this.saveEvent(printer.id, eventType, "Drucker liefert keine gültigen MQTT-Daten", "warn");
    this.broadcast({ type: "printer-status", printerId: printer.id });
  }

  scheduleReconnect(connection) {
    const key = connectionKey(connection.printer);
    const delay = Math.min(60000, 2000 * (2 ** connection.attempt));
    connection.reconnectTimer = setTimeout(() => {
      if (this.connections.get(key) !== connection) {
        return;
      }
      this.connections.delete(key);
      this.open(connection.printer, connection.attempt + 1);
    }, delay);
  }
}

export async function testBambuConnection(printer, timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (!canConnectPrinter({ ...printer, isActive: true })) {
      resolve({ success: false, message: "IP, Seriennummer und Access Code sind erforderlich." });
      return;
    }

    const subscriber = new BambuMqttSubscriber({
      host: printer.ipAddress,
      serialNumber: printer.serialNumber,
      accessCode: printer.accessCode,
      timeoutMs
    });
    let done = false;
    const timer = setTimeout(() => finish({ success: false, message: "Keine MQTT-Statusmeldung innerhalb von 10 Sekunden." }), timeoutMs);

    function finish(result) {
      if (done) {
        return;
      }
      done = true;
      clearTimeout(timer);
      subscriber.close();
      resolve(result);
    }

    subscriber.on("connect", () => {});
    subscriber.on("message", (_topic, message) => {
      finish({ success: true, message: "MQTT-Verbindung erfolgreich.", rawSample: message.slice(0, 4000) });
    });
    subscriber.on("error", (error) => {
      finish({ success: false, message: error.message });
    });
    subscriber.on("close", () => {
      if (!done) {
        finish({ success: false, message: "MQTT-Verbindung wurde geschlossen." });
      }
    });
    subscriber.connect();
  });
}
