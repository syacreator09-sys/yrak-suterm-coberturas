PRAGMA foreign_keys = ON;

CREATE TABLE intake_drafts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  attachment_id TEXT NOT NULL UNIQUE REFERENCES attachments(id) ON DELETE RESTRICT,
  source_type TEXT NOT NULL CHECK (source_type IN ('EMAIL','AUDIO','IMAGE','DOCUMENT','MANUAL')),
  draft_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REVIEW_PENDING' CHECK (status IN ('REVIEW_PENDING','APPROVED','REJECTED','SUPERSEDED')),
  linked_coverage_case_id TEXT REFERENCES coverage_cases(id) ON DELETE SET NULL,
  reviewed_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE organization_email_channels (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  inbound_address TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_intake_status ON intake_drafts(organization_id, status, created_at DESC);
