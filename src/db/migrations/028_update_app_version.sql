UPDATE app_settings
SET value = '0.0.24a', updated_at = datetime('now')
WHERE key = 'app_version';
