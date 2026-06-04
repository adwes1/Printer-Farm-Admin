ALTER TABLE materials
ADD COLUMN price_per_kg_net REAL NOT NULL DEFAULT 0;

UPDATE app_settings
SET value = '0.0.25a', updated_at = datetime('now')
WHERE key = 'app_version';
