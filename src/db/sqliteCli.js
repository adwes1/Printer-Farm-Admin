import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class SqliteCli {
  constructor(dbPath) {
    this.dbPath = dbPath;
  }

  async connect() {
    await mkdir(path.dirname(this.dbPath), { recursive: true });
    await this.exec("PRAGMA journal_mode = WAL; SELECT 1 AS ok;");
  }

  async exec(sql) {
    const { stdout } = await execFileAsync("sqlite3", ["-cmd", ".timeout 5000", this.dbPath, sql], {
      maxBuffer: 1024 * 1024 * 10
    });

    return stdout.trim();
  }

  async query(sql) {
    const { stdout } = await execFileAsync("sqlite3", ["-cmd", ".timeout 5000", "-json", this.dbPath, sql], {
      maxBuffer: 1024 * 1024 * 10
    });

    const output = stdout.trim();
    return output ? JSON.parse(output) : [];
  }
}
