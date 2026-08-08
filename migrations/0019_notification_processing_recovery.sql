-- Forward-only recovery metadata for at-least-once queue delivery.
-- Existing rows remain NULL. Consumer sets this when it atomically claims a notification.
ALTER TABLE notifications ADD COLUMN processing_started_at TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_processing_recovery
  ON notifications(status, processing_started_at, attempts);
