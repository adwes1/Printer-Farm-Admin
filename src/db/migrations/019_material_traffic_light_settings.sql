INSERT INTO app_settings (key, value, updated_at)
VALUES
  ('traffic_light_red_grams', '0', datetime('now')),
  ('traffic_light_threshold_grams', '3000', datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = datetime('now');

UPDATE app_settings
SET value = '0.0.18a', updated_at = datetime('now')
WHERE key = 'app_version';
