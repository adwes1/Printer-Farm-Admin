ALTER TABLE maintenance_tasks ADD COLUMN due_after_hours INTEGER NOT NULL DEFAULT 0;

UPDATE maintenance_tasks
SET
  name = 'Düse tauschen',
  description = 'Düse bei Verschleiß tauschen',
  due_after_hours = 1000,
  updated_at = datetime('now')
WHERE name = 'Düse ausgetauscht';

UPDATE maintenance_tasks
SET
  name = 'Spindeln reinigen und fetten',
  description = 'Bewegliche Teile, Achsen und Spindeln reinigen und fetten',
  due_after_hours = 500,
  updated_at = datetime('now')
WHERE name = 'Spindeln gereinigt';

INSERT OR IGNORE INTO maintenance_tasks (name, description, due_after_hours)
VALUES
  ('Düse und Hotend reinigen', 'Düse und Hotend reinigen', 50),
  ('Düse tauschen', 'Düse bei Verschleiß tauschen', 1000),
  ('Riemen und Schrauben prüfen', 'Riemen prüfen und Schrauben nachziehen', 100),
  ('Luftfilter und Trockenmittel tauschen', 'Aktivkohlefilter und Trockenmittel tauschen', 1000);
