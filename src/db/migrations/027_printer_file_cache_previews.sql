CREATE TABLE IF NOT EXISTS printer_file_cache (
  printer_id INTEGER PRIMARY KEY REFERENCES printers(id) ON DELETE CASCADE,
  source_path TEXT,
  preview_path TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
