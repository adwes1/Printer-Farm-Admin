import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { config } from "./config.js";
import { bootstrapApp } from "./db/bootstrap.js";
import { SqliteCli } from "./db/sqliteCli.js";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

let startupStatus;
const sessions = new Map();
const SESSION_COOKIE = "pfa_session";

function quoteSql(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function numberSql(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? String(Math.max(0, number)) : "0";
}

function parsePositiveId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
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

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [method, salt, storedHash] = String(passwordHash || "").split(":");
  if (method !== "scrypt" || !salt || !storedHash) {
    return false;
  }

  const calculated = scryptSync(String(password), salt, 64);
  const stored = Buffer.from(storedHash, "hex");
  return stored.length === calculated.length && timingSafeEqual(stored, calculated);
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

async function getDb() {
  const db = new SqliteCli(config.dbPath);
  await db.connect();
  return db;
}

async function getAppData(currentUser = null) {
  const db = await getDb();
  const [materials, storageLocations, printers, users] = await Promise.all([
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
    db.query(`
      SELECT id, name, location, status
      FROM printers
      ORDER BY name;
    `),
    db.query(`
      SELECT id, name, email, role
      FROM users
      ORDER BY role, name;
    `)
  ]);

  return {
    version: config.appVersion,
    startup: startupStatus,
    currentUser,
    materials,
    storageLocations,
    printers,
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

async function sendStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const publicDir = path.join(config.rootDir, "public");
  const filePath = path.normalize(path.join(publicDir, requestedPath));

  if (!filePath.startsWith(publicDir)) {
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

  createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      sendJson(response, 500, { error: "Unhandled server error", detail: error.message });
    });
  }).listen(config.port, config.host, () => {
    console.log(`Printer Farm Admin running at http://${config.host}:${config.port}`);
  });
}

main();
