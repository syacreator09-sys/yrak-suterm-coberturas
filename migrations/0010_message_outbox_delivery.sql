PRAGMA foreign_keys = ON;

ALTER TABLE messages ADD COLUMN outbox_event_id TEXT REFERENCES outbox_events(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_messages_outbox_recipient
  ON messages(outbox_event_id, recipient)
  WHERE outbox_event_id IS NOT NULL AND recipient IS NOT NULL;
