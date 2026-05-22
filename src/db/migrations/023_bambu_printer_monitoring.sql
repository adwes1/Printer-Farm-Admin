ALTER TABLE printers ADD COLUMN model TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE printers ADD COLUMN ip_address TEXT;
ALTER TABLE printers ADD COLUMN serial_number TEXT;
ALTER TABLE printers ADD COLUMN access_code TEXT;
ALTER TABLE printers ADD COLUMN has_ams INTEGER NOT NULL DEFAULT 0;
ALTER TABLE printers ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS printer_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  printer_id INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  online INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'unknown',
  progress_percent INTEGER,
  remaining_minutes INTEGER,
  nozzle_temp REAL,
  nozzle_target_temp REAL,
  bed_temp REAL,
  bed_target_temp REAL,
  chamber_temp REAL,
  current_layer INTEGER,
  total_layers INTEGER,
  current_file TEXT,
  subtask_name TEXT,
  ams_status_json TEXT,
  hms_errors_json TEXT,
  raw_json TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_printer_status_printer_received
ON printer_status (printer_id, received_at DESC);

CREATE TABLE IF NOT EXISTS printer_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  printer_id INTEGER REFERENCES printers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  raw_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO app_settings (key, value, updated_at)
VALUES ('bambu_store_raw_payloads', '1', datetime('now'))
ON CONFLICT(key) DO NOTHING;
