ALTER TABLE printers ADD COLUMN operating_seconds INTEGER NOT NULL DEFAULT 0;

UPDATE printers
SET operating_seconds = operating_hours * 3600
WHERE operating_seconds = 0
  AND operating_hours > 0;
