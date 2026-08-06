PRAGMA foreign_keys = ON;

CREATE TABLE requirements (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  requirement_type TEXT NOT NULL CHECK (requirement_type IN ('COURSE','CERTIFICATION','PREREQUISITE_EXAM','DOCUMENT','EXPERIENCE','OTHER')),
  validity_days INTEGER,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE target_level_requirements (
  target_level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
  mandatory INTEGER NOT NULL DEFAULT 1 CHECK (mandatory IN (0, 1)),
  valid_for_entire_coverage INTEGER NOT NULL DEFAULT 1 CHECK (valid_for_entire_coverage IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (target_level_id, requirement_id)
);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  sha256 TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  extraction_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (extraction_status IN ('PENDING','PROCESSING','REVIEW_REQUIRED','APPROVED','REJECTED','FAILED')),
  extracted_text TEXT,
  extraction_confidence REAL CHECK (extraction_confidence IS NULL OR (extraction_confidence >= 0 AND extraction_confidence <= 1)),
  uploaded_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE employee_requirements (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('COMPLIANT','MISSING','EXPIRED','PENDING','REJECTED','NOT_APPLICABLE')),
  completed_at TEXT,
  valid_until TEXT,
  score REAL CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  evidence_attachment_id TEXT REFERENCES attachments(id) ON DELETE SET NULL,
  verified_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  verified_at TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (employee_id, requirement_id)
);

CREATE INDEX idx_employee_requirements_lookup ON employee_requirements(employee_id, requirement_id, status);
CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id);
