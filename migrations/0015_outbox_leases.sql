PRAGMA foreign_keys = ON;

ALTER TABLE outbox_events ADD COLUMN locked_at TEXT;

CREATE TRIGGER outbox_processing_lock
AFTER UPDATE OF status ON outbox_events
WHEN NEW.status = 'PROCESSING'
BEGIN
  UPDATE outbox_events SET locked_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER outbox_processing_unlock
AFTER UPDATE OF status ON outbox_events
WHEN NEW.status IN ('PENDING','FAILED','SENT')
BEGIN
  UPDATE outbox_events SET locked_at = NULL WHERE id = NEW.id;
END;

CREATE INDEX idx_outbox_stale_processing
  ON outbox_events(status, locked_at)
  WHERE status = 'PROCESSING';
