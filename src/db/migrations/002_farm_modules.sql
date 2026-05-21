CREATE TABLE IF NOT EXISTS storage_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL,
  shelf TEXT NOT NULL,
  box TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (room, shelf, box)
);

CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'PLA',
  color_name TEXT NOT NULL,
  color_hex TEXT NOT NULL DEFAULT '#444444',
  quantity_grams INTEGER NOT NULL DEFAULT 0,
  storage_location_id INTEGER REFERENCES storage_locations(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO app_settings (key, value)
VALUES ('app_version', '0.0.1a');

INSERT OR IGNORE INTO storage_locations (room, shelf, box, note)
VALUES
  ('Druckraum', 'Regal A', 'Box 01', 'Standard-Filamente'),
  ('Druckraum', 'Regal A', 'Box 02', 'Technische Materialien'),
  ('Lager', 'Regal C', 'Box 07', 'Reservebestand');

INSERT OR IGNORE INTO materials (name, type, color_name, color_hex, quantity_grams, storage_location_id)
VALUES
  ('PLA Basic', 'PLA', 'Mattschwarz', '#202124', 2400, 1),
  ('PETG Strong', 'PETG', 'Signalrot', '#d64545', 1250, 2),
  ('PLA Silk', 'PLA', 'Kupfer', '#b56a3a', 780, 3);

INSERT OR IGNORE INTO printers (name, location, status)
VALUES
  ('Bambu P1S 01', 'Druckraum', 'printing'),
  ('Prusa MK4 02', 'Druckraum', 'idle'),
  ('Voron 2.4 03', 'Werkstatt', 'offline');

INSERT OR IGNORE INTO users (name, email, role, password_hash)
VALUES
  ('Administrator', 'admin@example.local', 'admin', 'initial-password-change-required');
