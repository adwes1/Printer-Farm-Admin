import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "../auth/passwords.js";
import { config } from "../config.js";
import { quoteSql } from "./sql.js";
import { SqliteCli } from "./sqliteCli.js";

const MIGRATION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function readMigrations() {
  const files = (await readdir(config.migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(
    files.map(async (file) => ({
      id: file,
      sql: await readFile(path.join(config.migrationsDir, file), "utf8")
    }))
  );
}

async function applyMigration(db, migration) {
  const sql = `
BEGIN;
${migration.sql}
INSERT INTO schema_migrations (id) VALUES (${quoteSql(migration.id)});
COMMIT;
`;

  try {
    await db.exec(sql);
  } catch (error) {
    await db.exec("ROLLBACK;").catch(() => {});
    throw error;
  }
}

async function readInstallState() {
  if (!(await exists(config.installFile))) {
    return { installed: false, metadata: null };
  }

  const raw = await readFile(config.installFile, "utf8");
  return { installed: true, metadata: JSON.parse(raw) };
}

async function writeInstallState(state) {
  await mkdir(path.dirname(config.installFile), { recursive: true });
  await writeFile(config.installFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function backupTimestamp() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function createMigrationBackup(db) {
  await db.exec("PRAGMA wal_checkpoint(FULL);");

  const backupDir = path.join(path.dirname(config.dbPath), "backups");
  await mkdir(backupDir, { recursive: true });

  const backupPath = path.join(backupDir, `printer-farm.before-migrations-${backupTimestamp()}.sqlite`);
  await copyFile(config.dbPath, backupPath);
  return backupPath;
}

async function ensureInitialAdmin(db) {
  const existingRows = await db.query("SELECT id, email FROM users WHERE role = 'admin' ORDER BY id LIMIT 1;");

  if (existingRows.length > 0) {
    return {
      created: false,
      email: existingRows[0].email
    };
  }

  const admin = config.initialAdmin;
  const name = String(admin.name || "").trim();
  const email = String(admin.email || "").trim().toLowerCase();
  const password = String(admin.password || "");

  if (!name || !email || !password) {
    throw new Error("Der initiale Admin in config.php benötigt Name, E-Mail und Passwort.");
  }

  const passwordHash = hashPassword(password);

  await db.exec(`
    INSERT INTO users (name, email, role, password_hash)
    VALUES (${quoteSql(name)}, ${quoteSql(email)}, 'admin', ${quoteSql(passwordHash)});
  `);

  return {
    created: true,
    email
  };
}

export async function bootstrapApp() {
  const startedAt = new Date().toISOString();
  const installState = await readInstallState();
  const db = new SqliteCli(config.dbPath);
  const databaseExistedBeforeStart = await exists(config.dbPath);

  const result = {
    startedAt,
    installed: installState.installed,
    database: {
      path: config.dbPath,
      connected: false,
      backupBeforeMigrations: null
    },
    schema: {
      checked: false,
      upToDate: false,
      appliedMigrations: [],
      pendingBeforeStart: []
    }
  };

  await db.connect();
  result.database.connected = true;

  await db.exec(MIGRATION_TABLE_SQL);
  const migrations = await readMigrations();
  const appliedRows = await db.query("SELECT id FROM schema_migrations ORDER BY id;");
  const appliedIds = new Set(appliedRows.map((row) => row.id));
  const pending = migrations.filter((migration) => !appliedIds.has(migration.id));

  result.schema.checked = true;
  result.schema.pendingBeforeStart = pending.map((migration) => migration.id);

  if (databaseExistedBeforeStart && pending.length > 0) {
    result.database.backupBeforeMigrations = await createMigrationBackup(db);
  }

  for (const migration of pending) {
    await applyMigration(db, migration);
    result.schema.appliedMigrations.push(migration.id);
  }

  const initialAdmin = await ensureInitialAdmin(db);
  result.initialAdmin = {
    name: config.initialAdmin.name,
    email: initialAdmin.email,
    created: initialAdmin.created
  };

  result.schema.upToDate = true;

  const installedAt = installState.metadata?.installedAt || startedAt;
  const metadata = {
    installedAt,
    updatedAt: startedAt,
    dbPath: config.dbPath,
    schemaVersion: migrations.at(-1)?.id || null
  };

  await writeInstallState(metadata);
  result.installed = true;
  result.installation = metadata;

  return result;
}
