INSERT INTO app_settings (key, value, updated_at)
VALUES ('app_version', '0.0.3a', datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = excluded.updated_at;
