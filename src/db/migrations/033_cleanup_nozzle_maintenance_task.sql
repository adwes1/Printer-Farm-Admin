UPDATE printer_maintenance_records
SET
  task_id = (SELECT id FROM maintenance_tasks WHERE name = 'Düse ausgetauscht' LIMIT 1),
  task_name = 'Düse tauschen'
WHERE task_id = (SELECT id FROM maintenance_tasks WHERE name = 'Düse tauschen' LIMIT 1)
  AND EXISTS (SELECT 1 FROM maintenance_tasks WHERE name = 'Düse ausgetauscht');

DELETE FROM maintenance_tasks
WHERE name = 'Düse tauschen'
  AND EXISTS (SELECT 1 FROM maintenance_tasks WHERE name = 'Düse ausgetauscht');

UPDATE maintenance_tasks
SET
  name = 'Düse tauschen',
  description = 'Düse bei Verschleiß tauschen',
  due_after_hours = 1000,
  updated_at = datetime('now')
WHERE name = 'Düse ausgetauscht';
