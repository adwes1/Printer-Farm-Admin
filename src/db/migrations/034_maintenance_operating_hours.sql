ALTER TABLE printers ADD COLUMN operating_hours INTEGER NOT NULL DEFAULT 0;

ALTER TABLE printer_maintenance_records ADD COLUMN performed_at_hours INTEGER NOT NULL DEFAULT 0;
