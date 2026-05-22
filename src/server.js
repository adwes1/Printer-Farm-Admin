import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { hashPassword, verifyPassword } from "./auth/passwords.js";
import { config } from "./config.js";
import { readBambuPreview } from "./bambu/fileCache.js";
import { mergeBambuStatus } from "./bambu/normalizer.js";
import { BambuCollector, testBambuConnection } from "./bambu/collector.js";
import { bootstrapApp } from "./db/bootstrap.js";
import { numberSql, parsePositiveId, quoteSql } from "./db/sql.js";
import { SqliteCli } from "./db/sqliteCli.js";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

let startupStatus;
let bambuCollector;
const sessions = new Map();
const sseClients = new Set();
const SESSION_COOKIE = "pfa_session";
const DEFAULT_TRAFFIC_LIGHT_SETTINGS = {
  redLimitGrams: 0,
  thresholdGrams: 3000
};
const DEFAULT_PRINTER_MONITORING_SETTINGS = {
  statusFlushIntervalMs: 5000
};

function normalizeMaintenanceTaskPayload(payload) {
  const dueAfterHours = Number.parseInt(String(payload.dueAfterHours ?? payload.due_after_hours ?? ""), 10);
  return {
    name: String(payload.name || "").trim(),
    description: String(payload.description || "").trim(),
    dueAfterHours: Number.isFinite(dueAfterHours) ? Math.max(0, dueAfterHours) : 0
  };
}

function normalizeMaintenanceRecordPayload(payload) {
  const performedAt = String(payload.performedAt || payload.performed_at || "").trim();
  const performedAtHours = Number.parseInt(String(payload.performedAtHours ?? payload.performed_at_hours ?? payload.operatingHours ?? ""), 10);
  return {
    taskId: parsePositiveId(payload.taskId || payload.task_id),
    performedAt,
    performedAtHours: Number.isFinite(performedAtHours) ? Math.max(0, performedAtHours) : null,
    note: String(payload.note || "").trim()
  };
}

function normalizeMaterialPayload(payload) {
  const manufacturer = String(payload.manufacturer || payload.name || "").trim();
  const type = String(payload.type || "PLA").trim();
  const colorName = String(payload.colorName || "").trim();
  const requestedColor = String(payload.colorHex || "#444444").trim();
  const colorHex = /^#[0-9a-f]{6}$/i.test(requestedColor) ? requestedColor : "#444444";
  const storageLocationId = payload.storageLocationId ? numberSql(payload.storageLocationId) : "NULL";

  return {
    manufacturer,
    type,
    colorName,
    colorHex,
    quantityGrams: numberSql(payload.quantityGrams),
    storageLocationId
  };
}

function normalizeTrafficLightSettings(payload) {
  const redLimitKg = Number.parseFloat(String(payload.redLimitKg ?? "").replace(",", "."));
  const thresholdKg = Number.parseFloat(String(payload.thresholdKg ?? "").replace(",", "."));
  const redLimitGrams = Number.isFinite(redLimitKg) ? Math.max(0, Math.round(redLimitKg * 1000)) : DEFAULT_TRAFFIC_LIGHT_SETTINGS.redLimitGrams;
  const thresholdGrams = Number.isFinite(thresholdKg) ? Math.max(redLimitGrams, Math.round(thresholdKg * 1000)) : DEFAULT_TRAFFIC_LIGHT_SETTINGS.thresholdGrams;

  return { redLimitGrams, thresholdGrams };
}

function normalizePrinterMonitoringSettings(payload) {
  const interval = Number.parseInt(String(payload.statusFlushIntervalMs ?? payload.status_flush_interval_ms ?? ""), 10);
  return {
    statusFlushIntervalMs: Number.isFinite(interval)
      ? Math.min(60000, Math.max(1000, interval))
      : DEFAULT_PRINTER_MONITORING_SETTINGS.statusFlushIntervalMs
  };
}

function normalizePrinterPayload(payload, existingPrinter = {}) {
  const model = ["P1S", "X1C", "H2D", "unknown"].includes(payload.model) ? payload.model : "unknown";
  const accessCode = String(payload.accessCode || payload.access_code || "").trim();
  const requestedOperatingHours = Number.parseFloat(String(payload.operatingHours ?? payload.operating_hours ?? "").replace(",", "."));
  const existingOperatingHours = Number(existingPrinter.operatingHours || 0);
  const hasAms = Object.hasOwn(payload, "hasAms") || Object.hasOwn(payload, "has_ams")
    ? payload.hasAms === true || payload.hasAms === "on" || payload.has_ams === 1 || payload.has_ams === "1"
    : Boolean(existingPrinter.hasAms);
  const isActive = Object.hasOwn(payload, "isActive") || Object.hasOwn(payload, "is_active")
    ? !(payload.isActive === false || payload.isActive === "0" || payload.is_active === 0)
    : existingPrinter.isActive !== false;
  const enableFileCacheLookup = Object.hasOwn(payload, "enableFileCacheLookup") || Object.hasOwn(payload, "enable_file_cache_lookup")
    ? payload.enableFileCacheLookup === true || payload.enableFileCacheLookup === "on" || payload.enable_file_cache_lookup === 1 || payload.enable_file_cache_lookup === "1"
    : Boolean(existingPrinter.enableFileCacheLookup);

  return {
    name: String(payload.name || "").trim(),
    model,
    ipAddress: String(payload.ipAddress || payload.ip_address || "").trim(),
    serialNumber: String(payload.serialNumber || payload.serial_number || "").trim(),
    accessCode: accessCode || existingPrinter.accessCode || "",
    hasAms: hasAms ? 1 : 0,
    location: String(payload.location || "").trim(),
    operatingHours: Number.isFinite(requestedOperatingHours) ? Math.max(0, requestedOperatingHours) : existingOperatingHours,
    enableFileCacheLookup: enableFileCacheLookup ? 1 : 0,
    isActive: isActive ? 1 : 0
  };
}

function operatingSecondsSql(hours) {
  const numericHours = Number(hours || 0);
  return String(Math.max(0, Math.round((Number.isFinite(numericHours) ? numericHours : 0) * 3600)));
}

function parseSqliteDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPrintingState(state) {
  return ["running", "printing", "pause"].includes(String(state || "").toLowerCase());
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const separator = cookie.indexOf("=");
        return [
          decodeURIComponent(cookie.slice(0, separator)),
          decodeURIComponent(cookie.slice(separator + 1))
        ];
      })
  );
}

function getSessionUser(request) {
  const sessionId = parseCookies(request)[SESSION_COOKIE];
  return sessionId ? sessions.get(sessionId) || null : null;
}

function sessionCookie(sessionId) {
  return `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(payload, null, 2));
}

function sendSse(response, event, payload) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastSse(event, payload) {
  for (const response of sseClients) {
    sendSse(response, event, payload);
  }
}

function isPathInside(filePath, directory) {
  const relative = path.relative(path.resolve(directory), path.resolve(filePath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function getDb() {
  const db = new SqliteCli(config.dbPath);
  await db.connect();
  return db;
}

function latestStatusJoin() {
  return `
    LEFT JOIN printer_status latest_status
      ON latest_status.id = (
        SELECT id
        FROM printer_status
        WHERE printer_status.printer_id = printers.id
        ORDER BY received_at DESC, id DESC
        LIMIT 1
      )
  `;
}

function canShowPrinterPreview(row) {
  return Boolean(row.online && row.previewPath && ["running", "printing", "pause"].includes(row.state));
}

function mapPrinter(row, includeSecret = false) {
  const printer = {
    id: row.id,
    name: row.name,
    model: row.model || "unknown",
    ipAddress: row.ipAddress || "",
    serialNumber: row.serialNumber || "",
    hasAms: Boolean(row.hasAms),
    enableFileCacheLookup: Boolean(row.enableFileCacheLookup),
    previewImageUrl: canShowPrinterPreview(row) ? `/api/printers/${row.id}/preview?ts=${encodeURIComponent(row.previewUpdatedAt || "")}` : null,
    location: row.location || "",
    operatingHours: Number(row.operatingSeconds || 0) / 3600,
    isActive: Boolean(row.isActive),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    status: row.statusId ? {
      id: row.statusId,
      online: Boolean(row.online),
      state: row.state || "unknown",
      progressPercent: row.progressPercent,
      remainingMinutes: row.remainingMinutes,
      nozzleTemp: row.nozzleTemp,
      nozzleTargetTemp: row.nozzleTargetTemp,
      bedTemp: row.bedTemp,
      bedTargetTemp: row.bedTargetTemp,
      chamberTemp: row.chamberTemp,
      currentLayer: row.currentLayer,
      totalLayers: row.totalLayers,
      currentFile: row.currentFile,
      subtaskName: row.subtaskName,
      amsStatusJson: row.amsStatusJson,
      hmsErrorsJson: row.hmsErrorsJson,
      receivedAt: row.receivedAt
    } : null
  };

  if (includeSecret) {
    printer.accessCode = row.accessCode || "";
  }

  return printer;
}

async function listPrinters({ includeInactive = false, includeSecret = false } = {}) {
  const db = await getDb();
  const rows = await db.query(`
    SELECT
      printers.id,
      printers.name,
      printers.model,
      printers.ip_address AS ipAddress,
      printers.serial_number AS serialNumber,
      printers.access_code AS accessCode,
      printers.has_ams AS hasAms,
      printers.enable_file_cache_lookup AS enableFileCacheLookup,
      printers.location,
      printers.operating_hours AS operatingHours,
      printers.operating_seconds AS operatingSeconds,
      printers.is_active AS isActive,
      printers.created_at AS createdAt,
      printers.updated_at AS updatedAt,
      latest_status.id AS statusId,
      latest_status.online,
      latest_status.state,
      latest_status.progress_percent AS progressPercent,
      latest_status.remaining_minutes AS remainingMinutes,
      latest_status.nozzle_temp AS nozzleTemp,
      latest_status.nozzle_target_temp AS nozzleTargetTemp,
      latest_status.bed_temp AS bedTemp,
      latest_status.bed_target_temp AS bedTargetTemp,
      latest_status.chamber_temp AS chamberTemp,
      latest_status.current_layer AS currentLayer,
      latest_status.total_layers AS totalLayers,
      latest_status.current_file AS currentFile,
      latest_status.subtask_name AS subtaskName,
      latest_status.ams_status_json AS amsStatusJson,
      latest_status.hms_errors_json AS hmsErrorsJson,
      latest_status.received_at AS receivedAt,
      file_cache.preview_path AS previewPath,
      file_cache.updated_at AS previewUpdatedAt
    FROM printers
    ${latestStatusJoin()}
    LEFT JOIN printer_file_cache file_cache ON file_cache.printer_id = printers.id
    ${includeInactive ? "" : "WHERE printers.is_active = 1"}
    ORDER BY printers.name;
  `);
  return rows.map((row) => mapPrinter(row, includeSecret));
}

async function getPrinterById(id, includeSecret = false) {
  const printerId = parsePositiveId(id);
  if (!printerId) {
    return null;
  }
  const db = await getDb();
  const rows = await db.query(`
    SELECT
      printers.id,
      printers.name,
      printers.model,
      printers.ip_address AS ipAddress,
      printers.serial_number AS serialNumber,
      printers.access_code AS accessCode,
      printers.has_ams AS hasAms,
      printers.enable_file_cache_lookup AS enableFileCacheLookup,
      printers.location,
      printers.operating_hours AS operatingHours,
      printers.operating_seconds AS operatingSeconds,
      printers.is_active AS isActive,
      printers.created_at AS createdAt,
      printers.updated_at AS updatedAt,
      latest_status.id AS statusId,
      latest_status.online,
      latest_status.state,
      latest_status.progress_percent AS progressPercent,
      latest_status.remaining_minutes AS remainingMinutes,
      latest_status.nozzle_temp AS nozzleTemp,
      latest_status.nozzle_target_temp AS nozzleTargetTemp,
      latest_status.bed_temp AS bedTemp,
      latest_status.bed_target_temp AS bedTargetTemp,
      latest_status.chamber_temp AS chamberTemp,
      latest_status.current_layer AS currentLayer,
      latest_status.total_layers AS totalLayers,
      latest_status.current_file AS currentFile,
      latest_status.subtask_name AS subtaskName,
      latest_status.ams_status_json AS amsStatusJson,
      latest_status.hms_errors_json AS hmsErrorsJson,
      latest_status.received_at AS receivedAt,
      file_cache.preview_path AS previewPath,
      file_cache.updated_at AS previewUpdatedAt
    FROM printers
    ${latestStatusJoin()}
    LEFT JOIN printer_file_cache file_cache ON file_cache.printer_id = printers.id
    WHERE printers.id = ${printerId}
    LIMIT 1;
  `);
  return rows[0] ? mapPrinter(rows[0], includeSecret) : null;
}

async function listMaintenanceTasks({ includeInactive = true } = {}) {
  const db = await getDb();
  const rows = await db.query(`
    SELECT
      id,
      name,
      description,
      due_after_hours AS dueAfterHours,
      is_active AS isActive,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM maintenance_tasks
    ${includeInactive ? "" : "WHERE is_active = 1"}
    ORDER BY is_active DESC, name;
  `);

  return rows.map((row) => ({
    ...row,
    isActive: Boolean(row.isActive)
  }));
}

async function listMaintenanceRecords() {
  const db = await getDb();
  return db.query(`
    SELECT
      records.id,
      records.printer_id AS printerId,
      records.task_id AS taskId,
      records.task_name AS taskName,
      records.performed_at AS performedAt,
      records.performed_at_hours AS performedAtHours,
      records.note,
      records.created_at AS createdAt
    FROM printer_maintenance_records records
    INNER JOIN printers ON printers.id = records.printer_id
    WHERE printers.is_active = 1
    ORDER BY records.performed_at DESC, records.id DESC
    LIMIT 1000;
  `);
}

async function shouldStoreRawPayloads() {
  const db = await getDb();
  const rows = await db.query("SELECT value FROM app_settings WHERE key = 'bambu_store_raw_payloads' LIMIT 1;");
  return rows[0]?.value !== "0";
}

async function getPrinterMonitoringSettings() {
  const db = await getDb();
  const rows = await db.query(`
    SELECT key, value
    FROM app_settings
    WHERE key = 'printer_status_flush_interval_ms';
  `);
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const interval = Number.parseInt(settings.printer_status_flush_interval_ms, 10);
  return {
    statusFlushIntervalMs: Number.isFinite(interval)
      ? Math.min(60000, Math.max(1000, interval))
      : DEFAULT_PRINTER_MONITORING_SETTINGS.statusFlushIntervalMs
  };
}

async function getLatestPrinterStatus(printerId) {
  const db = await getDb();
  const rows = await db.query(`
    SELECT
      online,
      state,
      progress_percent AS progressPercent,
      remaining_minutes AS remainingMinutes,
      nozzle_temp AS nozzleTemp,
      nozzle_target_temp AS nozzleTargetTemp,
      bed_temp AS bedTemp,
      bed_target_temp AS bedTargetTemp,
      chamber_temp AS chamberTemp,
      current_layer AS currentLayer,
      total_layers AS totalLayers,
      current_file AS currentFile,
      subtask_name AS subtaskName,
      ams_status_json AS amsStatusJson,
      hms_errors_json AS hmsErrorsJson,
      received_at AS receivedAt
    FROM printer_status
    WHERE printer_id = ${Number.parseInt(printerId, 10)}
    ORDER BY received_at DESC, id DESC
    LIMIT 1;
  `);

  return rows[0] ? { ...rows[0], online: Boolean(rows[0].online) } : null;
}

async function savePrinterStatus(printerId, status) {
  const db = await getDb();
  const latestStatus = status.online ? await getLatestPrinterStatus(printerId) : null;
  const mergedStatus = status.online && latestStatus?.online ? mergeBambuStatus(latestStatus, status) : status;
  const rawJson = await shouldStoreRawPayloads() ? status.rawJson : null;
  const latestReceivedAt = parseSqliteDate(latestStatus?.receivedAt);
  const onlineSeconds = mergedStatus.online && latestStatus?.online && isPrintingState(latestStatus.state) && latestReceivedAt
    ? Math.min(120, Math.max(0, Math.floor((Date.now() - latestReceivedAt.getTime()) / 1000)))
    : 0;
  await db.exec(`
    ${onlineSeconds > 0 ? `
    UPDATE printers
    SET
      operating_seconds = operating_seconds + ${onlineSeconds},
      operating_hours = CAST((operating_seconds + ${onlineSeconds}) / 3600 AS INTEGER),
      updated_at = datetime('now')
    WHERE id = ${Number.parseInt(printerId, 10)};
    ` : ""}
    INSERT INTO printer_status (
      printer_id,
      online,
      state,
      progress_percent,
      remaining_minutes,
      nozzle_temp,
      nozzle_target_temp,
      bed_temp,
      bed_target_temp,
      chamber_temp,
      current_layer,
      total_layers,
      current_file,
      subtask_name,
      ams_status_json,
      hms_errors_json,
      raw_json,
      received_at
    )
    VALUES (
      ${Number.parseInt(printerId, 10)},
      ${mergedStatus.online ? 1 : 0},
      ${quoteSql(mergedStatus.state || "unknown")},
      ${mergedStatus.progressPercent === null ? "NULL" : numberSql(mergedStatus.progressPercent)},
      ${mergedStatus.remainingMinutes === null ? "NULL" : numberSql(mergedStatus.remainingMinutes)},
      ${mergedStatus.nozzleTemp === null ? "NULL" : quoteSql(mergedStatus.nozzleTemp)},
      ${mergedStatus.nozzleTargetTemp === null ? "NULL" : quoteSql(mergedStatus.nozzleTargetTemp)},
      ${mergedStatus.bedTemp === null ? "NULL" : quoteSql(mergedStatus.bedTemp)},
      ${mergedStatus.bedTargetTemp === null ? "NULL" : quoteSql(mergedStatus.bedTargetTemp)},
      ${mergedStatus.chamberTemp === null ? "NULL" : quoteSql(mergedStatus.chamberTemp)},
      ${mergedStatus.currentLayer === null ? "NULL" : numberSql(mergedStatus.currentLayer)},
      ${mergedStatus.totalLayers === null ? "NULL" : numberSql(mergedStatus.totalLayers)},
      ${quoteSql(mergedStatus.currentFile)},
      ${quoteSql(mergedStatus.subtaskName)},
      ${quoteSql(mergedStatus.amsStatusJson)},
      ${quoteSql(mergedStatus.hmsErrorsJson)},
      ${quoteSql(rawJson)},
      datetime('now')
    );
  `);
}

async function savePrinterEvent(printerId, eventType, message, severity = "info", rawJson = null) {
  const db = await getDb();
  await db.exec(`
    INSERT INTO printer_events (printer_id, event_type, message, severity, raw_json)
    VALUES (
      ${printerId ? Number.parseInt(printerId, 10) : "NULL"},
      ${quoteSql(eventType)},
      ${quoteSql(message)},
      ${quoteSql(severity)},
      ${quoteSql(rawJson)}
    );
  `);
}

async function resolvePrinterPreview(printer, filePath, status = {}) {
  const image = await readBambuPreview({ printer, filePath, status });
  if (!image) {
    const db = await getDb();
    await db.exec(`
      DELETE FROM printer_file_cache
      WHERE printer_id = ${Number.parseInt(printer.id, 10)};
    `);
    return false;
  }
  const previewsDir = path.join(path.dirname(config.dbPath), "previews");
  await mkdir(previewsDir, { recursive: true });
  const previewPath = path.join(previewsDir, `printer-${printer.id}.png`);
  await writeFile(previewPath, image);
  const db = await getDb();
  await db.exec(`
    INSERT INTO printer_file_cache (printer_id, source_path, preview_path, updated_at)
    VALUES (${Number.parseInt(printer.id, 10)}, ${quoteSql(filePath)}, ${quoteSql(previewPath)}, datetime('now'))
    ON CONFLICT(printer_id) DO UPDATE SET
      source_path = excluded.source_path,
      preview_path = excluded.preview_path,
      updated_at = excluded.updated_at;
  `);
  return true;
}

async function sendPrinterPreview(id, response) {
  const printerId = parsePositiveId(id);
  if (!printerId) {
    sendJson(response, 400, { error: "Ungültige Drucker-ID." });
    return;
  }
  const db = await getDb();
  const rows = await db.query(`
    SELECT preview_path AS previewPath
    FROM printer_file_cache
    WHERE printer_id = ${printerId}
    LIMIT 1;
  `);
  const previewPath = rows[0]?.previewPath;
  const previewsDir = path.join(path.dirname(config.dbPath), "previews");
  if (!previewPath || !isPathInside(previewPath, previewsDir)) {
    sendJson(response, 404, { error: "Keine Vorschau verfügbar." });
    return;
  }
  try {
    await stat(previewPath);
    response.writeHead(200, { "content-type": "image/png", "cache-control": "no-cache" });
    createReadStream(previewPath).pipe(response);
  } catch {
    sendJson(response, 404, { error: "Keine Vorschau verfügbar." });
  }
}

async function getAppData(currentUser = null) {
  const db = await getDb();
  const [materials, storageLocations, printers, users, maintenanceTasks, maintenanceRecords, settingsRows] = await Promise.all([
    db.query(`
      SELECT
        materials.id,
        materials.name,
        materials.name AS manufacturer,
        materials.type,
        materials.color_name AS colorName,
        materials.color_hex AS colorHex,
        materials.quantity_grams AS quantityGrams,
        materials.storage_location_id AS storageLocationId,
        storage_locations.room,
        storage_locations.shelf,
        storage_locations.box
      FROM materials
      LEFT JOIN storage_locations ON storage_locations.id = materials.storage_location_id
      ORDER BY materials.name;
    `),
    db.query(`
      SELECT id, room, shelf, box, note
      FROM storage_locations
      ORDER BY room, shelf, box;
    `),
    listPrinters({ includeInactive: false }),
    db.query(`
      SELECT id, name, email, role
      FROM users
      ORDER BY role, name;
    `),
    listMaintenanceTasks(),
    listMaintenanceRecords(),
    db.query(`
      SELECT key, value
      FROM app_settings
      WHERE key IN ('traffic_light_red_grams', 'traffic_light_threshold_grams', 'printer_status_flush_interval_ms');
    `)
  ]);
  const settings = Object.fromEntries(settingsRows.map((row) => [row.key, row.value]));
  const redLimitGrams = Number.parseInt(settings.traffic_light_red_grams, 10);
  const thresholdGrams = Number.parseInt(settings.traffic_light_threshold_grams, 10);
  const statusFlushIntervalMs = Number.parseInt(settings.printer_status_flush_interval_ms, 10);
  const trafficLight = {
    redLimitGrams: Number.isFinite(redLimitGrams) ? redLimitGrams : DEFAULT_TRAFFIC_LIGHT_SETTINGS.redLimitGrams,
    thresholdGrams: Number.isFinite(thresholdGrams) ? thresholdGrams : DEFAULT_TRAFFIC_LIGHT_SETTINGS.thresholdGrams
  };
  const printerMonitoring = {
    statusFlushIntervalMs: Number.isFinite(statusFlushIntervalMs)
      ? Math.min(60000, Math.max(1000, statusFlushIntervalMs))
      : DEFAULT_PRINTER_MONITORING_SETTINGS.statusFlushIntervalMs
  };

  return {
    version: config.appVersion,
    startup: startupStatus,
    currentUser,
    materials,
    storageLocations,
    printers,
    maintenanceTasks,
    maintenanceRecords,
    trafficLight,
    printerMonitoring,
    users: currentUser?.role === "admin" ? users : []
  };
}

async function login(payload) {
  const db = await getDb();
  const username = String(payload.username || payload.name || "").trim();
  const password = String(payload.password || "");

  if (!username || !password) {
    return { ok: false, statusCode: 400, error: "User-Name und Passwort sind erforderlich." };
  }

  const users = await db.query(`
    SELECT id, name, email, role, password_hash AS passwordHash
    FROM users
    WHERE name = ${quoteSql(username)} COLLATE NOCASE
    LIMIT 1;
  `);
  const user = users[0];

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false, statusCode: 401, error: "Anmeldung fehlgeschlagen." };
  }

  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
  const sessionId = randomBytes(32).toString("hex");
  sessions.set(sessionId, sessionUser);

  return { ok: true, statusCode: 200, sessionId, data: { user: sessionUser } };
}

async function createMaterial(payload, currentUser) {
  const db = await getDb();
  const material = normalizeMaterialPayload(payload);

  if (!material.manufacturer || !material.type || !material.colorName) {
    return { ok: false, statusCode: 400, error: "Hersteller, Materialtyp und Farbe sind erforderlich." };
  }

  await db.exec(`
    INSERT INTO materials (name, type, color_name, color_hex, quantity_grams, storage_location_id)
    VALUES (
      ${quoteSql(material.manufacturer)},
      ${quoteSql(material.type)},
      ${quoteSql(material.colorName)},
      ${quoteSql(material.colorHex)},
      ${material.quantityGrams},
      ${material.storageLocationId}
    );
  `);

  return { ok: true, statusCode: 201, data: await getAppData(currentUser) };
}

async function updateMaterial(id, payload, currentUser) {
  const db = await getDb();
  const materialId = parsePositiveId(id);
  const material = normalizeMaterialPayload(payload);

  if (!materialId) {
    return { ok: false, statusCode: 400, error: "Ungültige Material-ID." };
  }

  if (!material.manufacturer || !material.type || !material.colorName) {
    return { ok: false, statusCode: 400, error: "Hersteller, Materialtyp und Farbe sind erforderlich." };
  }

  await db.exec(`
    UPDATE materials
    SET
      name = ${quoteSql(material.manufacturer)},
      type = ${quoteSql(material.type)},
      color_name = ${quoteSql(material.colorName)},
      color_hex = ${quoteSql(material.colorHex)},
      quantity_grams = ${material.quantityGrams},
      storage_location_id = ${material.storageLocationId},
      updated_at = datetime('now')
    WHERE id = ${materialId};
  `);

  return { ok: true, statusCode: 200, data: await getAppData(currentUser) };
}

async function adjustMaterialQuantity(id, payload, currentUser) {
  const db = await getDb();
  const materialId = parsePositiveId(id);
  const delta = Number.parseInt(payload.deltaGrams, 10);

  if (!materialId || !Number.isInteger(delta) || delta === 0) {
    return { ok: false, statusCode: 400, error: "Material-ID und Grammwert sind erforderlich." };
  }

  await db.exec(`
    UPDATE materials
    SET
      quantity_grams = MAX(0, quantity_grams + ${delta}),
      updated_at = datetime('now')
    WHERE id = ${materialId};
  `);

  return { ok: true, statusCode: 200, data: await getAppData(currentUser) };
}

async function deleteMaterial(id, currentUser) {
  const db = await getDb();
  const materialId = parsePositiveId(id);

  if (!materialId) {
    return { ok: false, statusCode: 400, error: "Ungültige Material-ID." };
  }

  await db.exec(`DELETE FROM materials WHERE id = ${materialId};`);
  return { ok: true, statusCode: 200, data: await getAppData(currentUser) };
}

async function createStorageLocation(payload, currentUser) {
  const db = await getDb();
  const room = String(payload.room || "").trim();
  const shelf = String(payload.shelf || "").trim();
  const box = String(payload.box || "").trim();

  if (!room || !shelf || !box) {
    return { ok: false, statusCode: 400, error: "Raum, Regal und Box sind erforderlich." };
  }

  await db.exec(`
    INSERT OR IGNORE INTO storage_locations (room, shelf, box, note)
    VALUES (${quoteSql(room)}, ${quoteSql(shelf)}, ${quoteSql(box)}, ${quoteSql(payload.note || "")});
  `);

  return { ok: true, statusCode: 201, data: await getAppData(currentUser) };
}

async function updateStorageLocation(id, payload, currentUser) {
  const db = await getDb();
  const storageLocationId = parsePositiveId(id);
  const room = String(payload.room || "").trim();
  const shelf = String(payload.shelf || "").trim();
  const box = String(payload.box || "").trim();

  if (!storageLocationId) {
    return { ok: false, statusCode: 400, error: "Ungültige Lagerplatz-ID." };
  }

  if (!room || !shelf || !box) {
    return { ok: false, statusCode: 400, error: "Raum, Regal und Box sind erforderlich." };
  }

  const existingLocations = await db.query(`
    SELECT id
    FROM storage_locations
    WHERE room = ${quoteSql(room)}
      AND shelf = ${quoteSql(shelf)}
      AND box = ${quoteSql(box)}
      AND id != ${storageLocationId}
    LIMIT 1;
  `);

  if (existingLocations.length > 0) {
    return { ok: false, statusCode: 409, error: "Dieser Lagerplatz existiert bereits." };
  }

  await db.exec(`
    UPDATE storage_locations
    SET
      room = ${quoteSql(room)},
      shelf = ${quoteSql(shelf)},
      box = ${quoteSql(box)},
      note = ${quoteSql(payload.note || "")},
      updated_at = datetime('now')
    WHERE id = ${storageLocationId};
  `);

  return { ok: true, statusCode: 200, data: await getAppData(currentUser) };
}

async function deleteStorageLocation(id, currentUser) {
  const db = await getDb();
  const storageLocationId = Number.parseInt(id, 10);

  if (!Number.isInteger(storageLocationId) || storageLocationId < 1) {
    return { ok: false, statusCode: 400, error: "Ungültige Lagerplatz-ID." };
  }

  await db.exec(`
    BEGIN;
    UPDATE materials
    SET storage_location_id = NULL, updated_at = datetime('now')
    WHERE storage_location_id = ${storageLocationId};
    DELETE FROM storage_locations WHERE id = ${storageLocationId};
    COMMIT;
  `);

  return { ok: true, statusCode: 200, data: await getAppData(currentUser) };
}

async function createUser(payload, currentUser) {
  const db = await getDb();
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const role = payload.role === "admin" ? "admin" : "user";
  const password = String(payload.password || "");

  if (!name || !email || password.length < 8) {
    return { ok: false, statusCode: 400, error: "Name, E-Mail und ein Passwort mit mindestens 8 Zeichen sind erforderlich." };
  }

  const existingNames = await db.query(`
    SELECT id
    FROM users
    WHERE name = ${quoteSql(name)} COLLATE NOCASE
    LIMIT 1;
  `);

  if (existingNames.length > 0) {
    return { ok: false, statusCode: 409, error: "Dieser User-Name ist bereits vergeben." };
  }

  await db.exec(`
    INSERT INTO users (name, email, role, password_hash)
    VALUES (${quoteSql(name)}, ${quoteSql(email)}, ${quoteSql(role)}, ${quoteSql(hashPassword(password))});
  `);

  return { ok: true, statusCode: 201, data: await getAppData(currentUser) };
}

async function updateUser(id, payload, currentUser) {
  const db = await getDb();
  const userId = parsePositiveId(id);
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const role = payload.role === "admin" ? "admin" : "user";
  const password = String(payload.password || "");

  if (!userId) {
    return { ok: false, statusCode: 400, error: "Ungültige User-ID." };
  }

  if (!name || !email) {
    return { ok: false, statusCode: 400, error: "Name und E-Mail sind erforderlich." };
  }

  const existingNames = await db.query(`
    SELECT id
    FROM users
    WHERE name = ${quoteSql(name)} COLLATE NOCASE
      AND id != ${userId}
    LIMIT 1;
  `);

  if (existingNames.length > 0) {
    return { ok: false, statusCode: 409, error: "Dieser User-Name ist bereits vergeben." };
  }

  if (password && password.length < 8) {
    return { ok: false, statusCode: 400, error: "Das Passwort muss mindestens 8 Zeichen haben." };
  }

  const passwordSql = password
    ? `, password_hash = ${quoteSql(hashPassword(password))}`
    : "";

  await db.exec(`
    UPDATE users
    SET
      name = ${quoteSql(name)},
      email = ${quoteSql(email)},
      role = ${quoteSql(role)},
      updated_at = datetime('now')
      ${passwordSql}
    WHERE id = ${userId};
  `);

  return { ok: true, statusCode: 200, data: await getAppData(currentUser) };
}

async function deleteUser(id, currentUser) {
  const db = await getDb();
  const userId = parsePositiveId(id);

  if (!userId) {
    return { ok: false, statusCode: 400, error: "Ungültige User-ID." };
  }

  await db.exec(`DELETE FROM users WHERE id = ${userId};`);
  return { ok: true, statusCode: 200, data: await getAppData(currentUser) };
}

async function updateTrafficLightSettings(payload, currentUser) {
  const db = await getDb();
  const settings = normalizeTrafficLightSettings(payload);

  await db.exec(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES
      ('traffic_light_red_grams', ${quoteSql(settings.redLimitGrams)}, datetime('now')),
      ('traffic_light_threshold_grams', ${quoteSql(settings.thresholdGrams)}, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now');
  `);

  return { ok: true, statusCode: 200, data: await getAppData(currentUser) };
}

async function updatePrinterMonitoringSettings(payload, currentUser) {
  const db = await getDb();
  const settings = normalizePrinterMonitoringSettings(payload);

  await db.exec(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('printer_status_flush_interval_ms', ${quoteSql(settings.statusFlushIntervalMs)}, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now');
  `);

  bambuCollector?.setStatusFlushIntervalMs(settings.statusFlushIntervalMs);
  return { ok: true, statusCode: 200, data: await getAppData(currentUser) };
}

async function createMaintenanceTask(payload, currentUser) {
  const db = await getDb();
  const task = normalizeMaintenanceTaskPayload(payload);

  if (!task.name) {
    return { ok: false, statusCode: 400, error: "Name der Wartungsart ist erforderlich." };
  }

  const existingRows = await db.query(`
    SELECT id
    FROM maintenance_tasks
    WHERE name = ${quoteSql(task.name)} COLLATE NOCASE
    LIMIT 1;
  `);

  if (existingRows.length > 0) {
    await db.exec(`
      UPDATE maintenance_tasks
      SET
        name = ${quoteSql(task.name)},
        description = ${quoteSql(task.description)},
        due_after_hours = ${numberSql(task.dueAfterHours)},
        is_active = 1,
        updated_at = datetime('now')
      WHERE id = ${Number.parseInt(existingRows[0].id, 10)};
    `);
  } else {
    await db.exec(`
      INSERT INTO maintenance_tasks (name, description, due_after_hours)
      VALUES (${quoteSql(task.name)}, ${quoteSql(task.description)}, ${numberSql(task.dueAfterHours)});
    `);
  }

  return { ok: true, statusCode: 201, data: await getAppData(currentUser) };
}

async function updateMaintenanceTask(id, payload, currentUser) {
  const db = await getDb();
  const taskId = parsePositiveId(id);
  const task = normalizeMaintenanceTaskPayload(payload);

  if (!taskId) {
    return { ok: false, statusCode: 400, error: "Ungültige Wartungsart-ID." };
  }

  if (!task.name) {
    return { ok: false, statusCode: 400, error: "Name der Wartungsart ist erforderlich." };
  }

  const existingRows = await db.query(`
    SELECT id
    FROM maintenance_tasks
    WHERE name = ${quoteSql(task.name)} COLLATE NOCASE
      AND id != ${taskId}
    LIMIT 1;
  `);

  if (existingRows.length > 0) {
    return { ok: false, statusCode: 409, error: "Diese Wartungsart existiert bereits." };
  }

  await db.exec(`
    UPDATE maintenance_tasks
    SET
      name = ${quoteSql(task.name)},
      description = ${quoteSql(task.description)},
      due_after_hours = ${numberSql(task.dueAfterHours)},
      is_active = 1,
      updated_at = datetime('now')
    WHERE id = ${taskId};
  `);

  return { ok: true, statusCode: 200, data: await getAppData(currentUser) };
}

async function deleteMaintenanceTask(id, currentUser) {
  const db = await getDb();
  const taskId = parsePositiveId(id);

  if (!taskId) {
    return { ok: false, statusCode: 400, error: "Ungültige Wartungsart-ID." };
  }

  await db.exec(`
    UPDATE maintenance_tasks
    SET is_active = 0, updated_at = datetime('now')
    WHERE id = ${taskId};
  `);

  return { ok: true, statusCode: 200, data: await getAppData(currentUser) };
}

async function createPrinterMaintenanceRecord(id, payload, currentUser) {
  const db = await getDb();
  const printerId = parsePositiveId(id);
  const record = normalizeMaintenanceRecordPayload(payload);

  if (!printerId) {
    return { ok: false, statusCode: 400, error: "Ungültige Drucker-ID." };
  }

  if (!record.taskId || !record.performedAt || record.performedAtHours === null) {
    return { ok: false, statusCode: 400, error: "Wartungsart, Datum und Betriebsstunden sind erforderlich." };
  }

  const date = new Date(record.performedAt);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, statusCode: 400, error: "Das Wartungsdatum ist ungültig." };
  }

  const [printer] = await db.query(`
    SELECT id, operating_hours AS operatingHours
    FROM printers
    WHERE id = ${printerId}
      AND is_active = 1
    LIMIT 1;
  `);

  if (!printer) {
    return { ok: false, statusCode: 404, error: "Drucker wurde nicht gefunden." };
  }

  const [task] = await db.query(`
    SELECT id, name, due_after_hours AS dueAfterHours
    FROM maintenance_tasks
    WHERE id = ${record.taskId}
      AND is_active = 1
    LIMIT 1;
  `);

  if (!task) {
    return { ok: false, statusCode: 404, error: "Wartungsart wurde nicht gefunden." };
  }

  await db.exec(`
    BEGIN;
    UPDATE printers
    SET
      operating_hours = MAX(operating_hours, ${numberSql(record.performedAtHours)}),
      operating_seconds = MAX(operating_seconds, ${operatingSecondsSql(record.performedAtHours)}),
      updated_at = datetime('now')
    WHERE id = ${printerId};
    INSERT INTO printer_maintenance_records (printer_id, task_id, task_name, performed_at, performed_at_hours, note)
    VALUES (
      ${printerId},
      ${record.taskId},
      ${quoteSql(task.name)},
      ${quoteSql(record.performedAt)},
      ${numberSql(record.performedAtHours)},
      ${quoteSql(record.note)}
    );
    COMMIT;
  `);

  return { ok: true, statusCode: 201, data: await getAppData(currentUser) };
}

async function createPrinter(payload, currentUser) {
  const db = await getDb();
  const printer = normalizePrinterPayload(payload);

  if (!printer.name || !printer.ipAddress || !printer.serialNumber || !printer.accessCode) {
    return { ok: false, statusCode: 400, error: "Name, IP-Adresse, Seriennummer und Access Code sind erforderlich." };
  }

  await db.exec(`
    INSERT INTO printers (
      name,
      model,
      ip_address,
      serial_number,
      access_code,
      has_ams,
      location,
      operating_hours,
      operating_seconds,
      enable_file_cache_lookup,
      is_active
    )
    VALUES (
      ${quoteSql(printer.name)},
      ${quoteSql(printer.model)},
      ${quoteSql(printer.ipAddress)},
      ${quoteSql(printer.serialNumber)},
      ${quoteSql(printer.accessCode)},
      ${printer.hasAms},
      ${quoteSql(printer.location)},
      ${numberSql(printer.operatingHours)},
      ${operatingSecondsSql(printer.operatingHours)},
      ${printer.enableFileCacheLookup},
      ${printer.isActive}
    );
  `);

  await bambuCollector?.refresh();
  return { ok: true, statusCode: 201, data: await getAppData(currentUser) };
}

async function updatePrinter(id, payload, currentUser) {
  const db = await getDb();
  const printerId = parsePositiveId(id);
  const existing = await getPrinterById(id, true);

  if (!printerId || !existing) {
    return { ok: false, statusCode: 404, error: "Drucker wurde nicht gefunden." };
  }

  const printer = normalizePrinterPayload(payload, existing);
  if (!printer.name || !printer.ipAddress || !printer.serialNumber || !printer.accessCode) {
    return { ok: false, statusCode: 400, error: "Name, IP-Adresse, Seriennummer und Access Code sind erforderlich." };
  }

  await db.exec(`
    UPDATE printers
    SET
      name = ${quoteSql(printer.name)},
      model = ${quoteSql(printer.model)},
      ip_address = ${quoteSql(printer.ipAddress)},
      serial_number = ${quoteSql(printer.serialNumber)},
      access_code = ${quoteSql(printer.accessCode)},
      has_ams = ${printer.hasAms},
      location = ${quoteSql(printer.location)},
      operating_hours = ${numberSql(printer.operatingHours)},
      operating_seconds = ${operatingSecondsSql(printer.operatingHours)},
      enable_file_cache_lookup = ${printer.enableFileCacheLookup},
      is_active = ${printer.isActive},
      updated_at = datetime('now')
    WHERE id = ${printerId};
  `);

  await bambuCollector?.refresh();
  return { ok: true, statusCode: 200, data: await getAppData(currentUser) };
}

async function deletePrinter(id, currentUser) {
  const db = await getDb();
  const printerId = parsePositiveId(id);

  if (!printerId) {
    return { ok: false, statusCode: 400, error: "Ungültige Drucker-ID." };
  }

  await db.exec(`
    BEGIN;
    DELETE FROM printer_events WHERE printer_id = ${printerId};
    DELETE FROM printer_status WHERE printer_id = ${printerId};
    DELETE FROM printers WHERE id = ${printerId};
    COMMIT;
  `);

  await bambuCollector?.refresh();
  return { ok: true, statusCode: 200, data: await getAppData(currentUser) };
}

async function testPrinterConnection(id) {
  const printer = await getPrinterById(id, true);
  if (!printer) {
    return { ok: false, statusCode: 404, error: "Drucker wurde nicht gefunden." };
  }
  const result = await testBambuConnection(printer);
  return { ok: result.success, statusCode: result.success ? 200 : 502, data: result, error: result.message };
}

async function getPrinterStatusHistory(id, url) {
  const printerId = parsePositiveId(id);
  const limit = Math.min(500, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "100", 10)));
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const where = [`printer_id = ${printerId}`];

  if (!printerId) {
    return { ok: false, statusCode: 400, error: "Ungültige Drucker-ID." };
  }
  if (from) {
    where.push(`received_at >= ${quoteSql(from)}`);
  }
  if (to) {
    where.push(`received_at <= ${quoteSql(to)}`);
  }

  const db = await getDb();
  const rows = await db.query(`
    SELECT
      id,
      online,
      state,
      progress_percent AS progressPercent,
      remaining_minutes AS remainingMinutes,
      nozzle_temp AS nozzleTemp,
      nozzle_target_temp AS nozzleTargetTemp,
      bed_temp AS bedTemp,
      bed_target_temp AS bedTargetTemp,
      chamber_temp AS chamberTemp,
      current_layer AS currentLayer,
      total_layers AS totalLayers,
      current_file AS currentFile,
      subtask_name AS subtaskName,
      ams_status_json AS amsStatusJson,
      hms_errors_json AS hmsErrorsJson,
      received_at AS receivedAt
    FROM printer_status
    WHERE ${where.join(" AND ")}
    ORDER BY received_at DESC, id DESC
    LIMIT ${limit};
  `);

  return {
    ok: true,
    statusCode: 200,
    data: rows.map((row) => ({ ...row, online: Boolean(row.online) }))
  };
}

async function sendStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const publicDir = path.resolve(config.rootDir, "public");
  const filePath = path.resolve(publicDir, requestedPath.replace(/^\/+/, ""));

  if (!isPathInside(filePath, publicDir)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    response.writeHead(200, {
      "content-type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream"
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { error: "Not found" });
      return;
    }
    sendJson(response, 500, { error: "Static file error", detail: error.message });
  }
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const currentUser = getSessionUser(request);

  if (url.pathname === "/api/login" && request.method === "POST") {
    const result = await login(await readJsonBody(request));
    sendJson(
      response,
      result.statusCode,
      result.ok ? result.data : { error: result.error },
      result.ok ? { "set-cookie": sessionCookie(result.sessionId) } : {}
    );
    return;
  }

  if (url.pathname === "/api/logout" && request.method === "POST") {
    const sessionId = parseCookies(request)[SESSION_COOKIE];
    if (sessionId) {
      sessions.delete(sessionId);
    }
    sendJson(response, 200, { ok: true }, { "set-cookie": clearSessionCookie() });
    return;
  }

  if (url.pathname === "/api/session" && request.method === "GET") {
    sendJson(response, 200, { user: currentUser });
    return;
  }

  if (url.pathname.startsWith("/api/") && !currentUser) {
    sendJson(response, 401, { error: "Nicht angemeldet." });
    return;
  }

  if (url.pathname === "/api/status" && request.method === "GET") {
    sendJson(response, startupStatus.ok ? 200 : 500, startupStatus);
    return;
  }

  if (url.pathname === "/api/app-data" && request.method === "GET") {
    sendJson(response, 200, await getAppData(currentUser));
    return;
  }

  if (url.pathname === "/api/printer-events" && request.method === "GET") {
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    sseClients.add(response);
    sendSse(response, "ready", { ok: true });
    request.on("close", () => {
      sseClients.delete(response);
    });
    return;
  }

  if (url.pathname === "/api/printers" && request.method === "GET") {
    sendJson(response, 200, await listPrinters());
    return;
  }

  if (url.pathname === "/api/printers" && request.method === "POST") {
    const result = await createPrinter(await readJsonBody(request), currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  const printerPreviewMatch = url.pathname.match(/^\/api\/printers\/(\d+)\/preview$/);
  if (printerPreviewMatch && request.method === "GET") {
    await sendPrinterPreview(printerPreviewMatch[1], response);
    return;
  }

  const printerTestMatch = url.pathname.match(/^\/api\/printers\/(\d+)\/test-connection$/);
  if (printerTestMatch && request.method === "POST") {
    const result = await testPrinterConnection(printerTestMatch[1]);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error, success: false, message: result.error });
    return;
  }

  const printerMaintenanceMatch = url.pathname.match(/^\/api\/printers\/(\d+)\/maintenance$/);
  if (printerMaintenanceMatch && request.method === "POST") {
    const result = await createPrinterMaintenanceRecord(printerMaintenanceMatch[1], await readJsonBody(request), currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  const printerHistoryMatch = url.pathname.match(/^\/api\/printers\/(\d+)\/status-history$/);
  if (printerHistoryMatch && request.method === "GET") {
    const result = await getPrinterStatusHistory(printerHistoryMatch[1], url);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  const printerGetMatch = url.pathname.match(/^\/api\/printers\/(\d+)$/);
  if (printerGetMatch && request.method === "GET") {
    const printer = await getPrinterById(printerGetMatch[1]);
    sendJson(response, printer ? 200 : 404, printer || { error: "Drucker wurde nicht gefunden." });
    return;
  }

  const printerUpdateMatch = url.pathname.match(/^\/api\/printers\/(\d+)$/);
  if (printerUpdateMatch && (request.method === "PATCH" || request.method === "POST")) {
    const result = await updatePrinter(printerUpdateMatch[1], await readJsonBody(request), currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  const printerDeleteMatch = url.pathname.match(/^\/api\/printers\/(\d+)$/);
  if (printerDeleteMatch && request.method === "DELETE") {
    const result = await deletePrinter(printerDeleteMatch[1], currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  if (url.pathname === "/api/materials" && request.method === "POST") {
    const result = await createMaterial(await readJsonBody(request), currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  const materialQuantityMatch = url.pathname.match(/^\/api\/materials\/(\d+)\/quantity$/);
  if (materialQuantityMatch && request.method === "PATCH") {
    const result = await adjustMaterialQuantity(materialQuantityMatch[1], await readJsonBody(request), currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  const materialUpdateMatch = url.pathname.match(/^\/api\/materials\/(\d+)$/);
  if (materialUpdateMatch && request.method === "PATCH") {
    const result = await updateMaterial(materialUpdateMatch[1], await readJsonBody(request), currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  const materialDeleteMatch = url.pathname.match(/^\/api\/materials\/(\d+)$/);
  if (materialDeleteMatch && request.method === "DELETE") {
    const result = await deleteMaterial(materialDeleteMatch[1], currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  if (url.pathname === "/api/storage-locations" && request.method === "POST") {
    const result = await createStorageLocation(await readJsonBody(request), currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  const storageUpdateMatch = url.pathname.match(/^\/api\/storage-locations\/(\d+)$/);
  if (storageUpdateMatch && request.method === "PATCH") {
    const result = await updateStorageLocation(storageUpdateMatch[1], await readJsonBody(request), currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  const storageDeleteMatch = url.pathname.match(/^\/api\/storage-locations\/(\d+)$/);
  if (storageDeleteMatch && request.method === "DELETE") {
    const result = await deleteStorageLocation(storageDeleteMatch[1], currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  if (url.pathname === "/api/users" && request.method === "POST") {
    if (currentUser.role !== "admin") {
      sendJson(response, 403, { error: "Nur Admins dürfen User verwalten." });
      return;
    }
    const result = await createUser(await readJsonBody(request), currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  const userUpdateMatch = url.pathname.match(/^\/api\/users\/(\d+)$/);
  if (userUpdateMatch && request.method === "PATCH") {
    if (currentUser.role !== "admin") {
      sendJson(response, 403, { error: "Nur Admins dürfen User verwalten." });
      return;
    }
    const result = await updateUser(userUpdateMatch[1], await readJsonBody(request), currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  const userDeleteMatch = url.pathname.match(/^\/api\/users\/(\d+)$/);
  if (userDeleteMatch && request.method === "DELETE") {
    if (currentUser.role !== "admin") {
      sendJson(response, 403, { error: "Nur Admins dürfen User verwalten." });
      return;
    }
    const result = await deleteUser(userDeleteMatch[1], currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  if (url.pathname === "/api/maintenance-tasks" && request.method === "POST") {
    if (currentUser.role !== "admin") {
      sendJson(response, 403, { error: "Nur Admins dürfen Einstellungen bearbeiten." });
      return;
    }
    const result = await createMaintenanceTask(await readJsonBody(request), currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  const maintenanceTaskUpdateMatch = url.pathname.match(/^\/api\/maintenance-tasks\/(\d+)$/);
  if (maintenanceTaskUpdateMatch && request.method === "PATCH") {
    if (currentUser.role !== "admin") {
      sendJson(response, 403, { error: "Nur Admins dürfen Einstellungen bearbeiten." });
      return;
    }
    const result = await updateMaintenanceTask(maintenanceTaskUpdateMatch[1], await readJsonBody(request), currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  const maintenanceTaskDeleteMatch = url.pathname.match(/^\/api\/maintenance-tasks\/(\d+)$/);
  if (maintenanceTaskDeleteMatch && request.method === "DELETE") {
    if (currentUser.role !== "admin") {
      sendJson(response, 403, { error: "Nur Admins dürfen Einstellungen bearbeiten." });
      return;
    }
    const result = await deleteMaintenanceTask(maintenanceTaskDeleteMatch[1], currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  if (url.pathname === "/api/settings/traffic-light" && request.method === "PATCH") {
    if (currentUser.role !== "admin") {
      sendJson(response, 403, { error: "Nur Admins dürfen Einstellungen bearbeiten." });
      return;
    }
    const result = await updateTrafficLightSettings(await readJsonBody(request), currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  if (url.pathname === "/api/settings/printer-monitoring" && request.method === "PATCH") {
    if (currentUser.role !== "admin") {
      sendJson(response, 403, { error: "Nur Admins dürfen Einstellungen bearbeiten." });
      return;
    }
    const result = await updatePrinterMonitoringSettings(await readJsonBody(request), currentUser);
    sendJson(response, result.statusCode, result.ok ? result.data : { error: result.error });
    return;
  }

  if (url.pathname === "/api/bootstrap" && request.method === "POST") {
    try {
      const status = await bootstrapApp();
      startupStatus = { ok: true, ...status };
      sendJson(response, 200, startupStatus);
    } catch (error) {
      startupStatus = { ok: false, error: error.message };
      sendJson(response, 500, startupStatus);
    }
    return;
  }

  if (url.pathname === "/health" && request.method === "GET") {
    sendJson(response, startupStatus.ok ? 200 : 500, {
      ok: startupStatus.ok,
      databaseConnected: Boolean(startupStatus.database?.connected),
      schemaUpToDate: Boolean(startupStatus.schema?.upToDate)
    });
    return;
  }

  if (request.method === "GET") {
    await sendStatic(request, response);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
}

async function main() {
  try {
    const status = await bootstrapApp();
    startupStatus = { ok: true, ...status };
  } catch (error) {
    startupStatus = { ok: false, error: error.message };
    console.error("Bootstrap failed:", error);
  }

  const printerMonitoringSettings = await getPrinterMonitoringSettings();
  bambuCollector = new BambuCollector({
    loadPrinters: () => listPrinters({ includeInactive: false, includeSecret: true }),
    saveStatus: savePrinterStatus,
    saveEvent: savePrinterEvent,
    resolvePreview: resolvePrinterPreview,
    broadcast: (payload) => broadcastSse("printer-status", payload),
    statusFlushIntervalMs: printerMonitoringSettings.statusFlushIntervalMs
  });
  bambuCollector.start();

  createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      sendJson(response, 500, { error: "Unhandled server error", detail: error.message });
    });
  }).listen(config.port, config.host, () => {
    console.log(`Printer Farm Admin running at http://${config.host}:${config.port}`);
  });
}

main();
