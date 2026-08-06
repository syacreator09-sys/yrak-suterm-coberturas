PRAGMA foreign_keys = ON;

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  requested_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  decided_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT,
  reason TEXT
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  coverage_case_id TEXT REFERENCES coverage_cases(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('EMAIL','WHATSAPP','WEB','SYSTEM')),
  direction TEXT NOT NULL CHECK (direction IN ('INBOUND','OUTBOUND')),
  recipient TEXT,
  subject TEXT,
  body_text TEXT NOT NULL,
  template_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','QUEUED','SENT','DELIVERED','FAILED','RECEIVED')),
  provider_message_id TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT
);

CREATE TABLE idempotency_keys (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_json TEXT,
  status_code INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  UNIQUE (organization_id, operation, idempotency_key)
);

CREATE TABLE outbox_events (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SENT','FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_id TEXT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('USER','SYSTEM','AGENT')),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_value_json TEXT,
  new_value_json TEXT,
  rule_applied TEXT,
  reason TEXT,
  correlation_id TEXT NOT NULL,
  ip_address_hash TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

CREATE TRIGGER audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only');
END;

CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id, occurred_at);
CREATE INDEX idx_audit_correlation ON audit_events(correlation_id, occurred_at);
CREATE INDEX idx_outbox_pending ON outbox_events(status, available_at);
