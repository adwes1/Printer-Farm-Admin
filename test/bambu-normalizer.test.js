import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { mergeBambuStatus, normalizeBambuStatus } from "../src/bambu/normalizer.js";

async function fixture(name) {
  const source = await readFile(new URL(`./fixtures/bambu/${name}.json`, import.meta.url), "utf8");
  return JSON.parse(source);
}

test("normalisiert P1S Payload während eines Drucks", async () => {
  const status = normalizeBambuStatus(await fixture("p1s-printing"), { id: 1 });

  assert.equal(status.printerId, 1);
  assert.equal(status.online, true);
  assert.equal(status.state, "running");
  assert.equal(status.progressPercent, 42);
  assert.equal(status.remainingMinutes, 86);
  assert.equal(status.nozzleTemp, 218.4);
  assert.equal(status.nozzleTargetTemp, 220);
  assert.equal(status.bedTemp, 64.8);
  assert.equal(status.bedTargetTemp, 65);
  assert.equal(status.chamberTemp, 38);
  assert.equal(status.currentLayer, 74);
  assert.equal(status.totalLayers, 180);
  assert.equal(status.currentFile, "farm-bracket.3mf");
  assert.ok(status.amsStatusJson);
  assert.ok(status.rawJson);
});

test("normalisiert X1C idle Payload", async () => {
  const status = normalizeBambuStatus(await fixture("x1c-idle"), { id: 2 });

  assert.equal(status.state, "idle");
  assert.equal(status.progressPercent, 0);
  assert.equal(status.remainingMinutes, 0);
  assert.equal(status.nozzleTargetTemp, 0);
  assert.equal(status.bedTargetTemp, 0);
  assert.equal(status.currentFile, null);
});

test("liest X1C Kammer-Temperatur aus verschachtelter info.temp Struktur", () => {
  const status = normalizeBambuStatus({
    print: {
      gcode_state: "RUNNING",
      mc_percent: 45,
      info: { temp: 39 },
      ctc: { info: { temp: 38 } }
    }
  }, { id: 2 });

  assert.equal(status.chamberTemp, 39);
});

test("bleibt bei H2D/unbekannter Payload mit fehlenden Feldern defensiv", async () => {
  const status = normalizeBambuStatus(await fixture("h2d-partial"), { id: 3 });

  assert.equal(status.state, "running");
  assert.equal(status.progressPercent, 7);
  assert.equal(status.bedTemp, 52.1);
  assert.equal(status.nozzleTemp, null);
  assert.equal(status.totalLayers, null);
  assert.equal(status.subtaskName, "unknown-h2d-job");
  assert.doesNotThrow(() => normalizeBambuStatus(null, { id: 3 }));
});

test("merged partielle Bambu Push-Statusmeldungen in den letzten bekannten Status", () => {
  const previous = {
    online: true,
    state: "running",
    progressPercent: 51,
    remainingMinutes: 195,
    nozzleTemp: 279.8,
    bedTemp: 99.9,
    currentLayer: 94,
    totalLayers: null
  };
  const next = normalizeBambuStatus({ print: { command: "push_status", nozzle_temper: 280 } }, { id: 5 });
  const merged = mergeBambuStatus(previous, next);

  assert.equal(merged.state, "running");
  assert.equal(merged.progressPercent, 51);
  assert.equal(merged.remainingMinutes, 195);
  assert.equal(merged.nozzleTemp, 280);
  assert.equal(merged.bedTemp, 99.9);
  assert.equal(merged.currentLayer, 94);
});

test("Offline-Status bleibt leer und uebernimmt keine alten Messwerte", () => {
  const previous = {
    online: true,
    state: "running",
    progressPercent: 56,
    remainingMinutes: 175,
    nozzleTemp: 280,
    bedTemp: 100,
    currentLayer: 102
  };
  const offline = {
    online: false,
    state: "offline",
    progressPercent: null,
    remainingMinutes: null,
    nozzleTemp: null,
    bedTemp: null,
    currentLayer: null
  };

  assert.equal(offline.online, false);
  assert.equal(offline.progressPercent, null);
  assert.equal(offline.nozzleTemp, null);
  assert.equal(previous.progressPercent, 56);
});
