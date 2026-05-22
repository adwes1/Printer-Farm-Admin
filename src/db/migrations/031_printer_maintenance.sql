CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS printer_maintenance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  printer_id INTEGER NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  task_id INTEGER REFERENCES maintenance_tasks(id) ON DELETE SET NULL,
  task_name TEXT NOT NULL,
  performed_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_printer_maintenance_records_printer_date
ON printer_maintenance_records (printer_id, performed_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_printer_maintenance_records_task
ON printer_maintenance_records (task_id);

INSERT OR IGNORE INTO maintenance_tasks (name, description)
VALUES
  ('Düse ausgetauscht', 'Austausch der Druckerdüse dokumentieren'),
  ('Spindeln gereinigt', 'Reinigung der Spindeln dokumentieren');
