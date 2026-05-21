import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const phpConfigPath = path.resolve(rootDir, "config.php");

function readPhpConfigValue(source, key) {
  const pattern = new RegExp(`['"]${key}['"]\\s*=>\\s*['"]([^'"]*)['"]`, "u");
  return source.match(pattern)?.[1]?.trim() || "";
}

function readPhpConfig() {
  if (!existsSync(phpConfigPath)) {
    return {};
  }

  const source = readFileSync(phpConfigPath, "utf8");
  return {
    dbPath: readPhpConfigValue(source, "db_path"),
    installFile: readPhpConfigValue(source, "install_file"),
    adminName: readPhpConfigValue(source, "admin_name"),
    adminEmail: readPhpConfigValue(source, "admin_email"),
    adminPassword: readPhpConfigValue(source, "admin_password")
  };
}

const phpConfig = readPhpConfig();

export const config = {
  rootDir,
  appVersion: "0.0.17a",
  host: process.env.HOST || "127.0.0.1",
  port: Number.parseInt(process.env.PORT || "3000", 10),
  dbPath: path.resolve(rootDir, process.env.DB_PATH || phpConfig.dbPath || "data/printer-farm.sqlite"),
  installFile: path.resolve(rootDir, process.env.INSTALL_FILE || phpConfig.installFile || "data/install.json"),
  migrationsDir: path.resolve(rootDir, "src/db/migrations"),
  initialAdmin: {
    name: process.env.ADMIN_NAME || phpConfig.adminName || "admin",
    email: process.env.ADMIN_EMAIL || phpConfig.adminEmail || "admin@example.local",
    password: process.env.ADMIN_PASSWORD || phpConfig.adminPassword || "admin"
  }
};
