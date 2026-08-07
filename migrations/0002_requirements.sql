CREATE TABLE requirements (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  requirement_type TEXT NOT NULL CHECK(requirement_type IN ('COURSE','CERTIFICATION','PREREQUISITE_EXAM','DOCUMENT','EXPERIENCE','OTHER')),
  validity_days INTEGER,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE target_level_requirements (
  target_level_id TEXT NOT NULL REFERENCES levels(id),
  requirement_id TEXT NOT NULL REFERENCES requirements(id),
  mandatory INTEGER NOT NULL DEFAULT 1 CHECK(mandatory IN (0,1)),
  valid_for_entire_coverage INTEGER NOT NULL DEFAULT 1 CHECK(valid_for_entire_coverage IN (0,1)),
  PRIMARY KEY(target_level_id, requirement_id)
);

CREATE TABLE employee_requirements (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  requirement_id TEXT NOT NULL REFERENCES requirements(id),
  status TEXT NOT NULL CHECK(status IN ('COMPLIANT','MISSING','EXPIRED','PENDING','REJECTED','NOT_APPLICABLE')),
  completed_at TEXT,
  valid_until TEXT,
  score REAL CHECK(score IS NULL OR (score >= 0 AND score <= 100)),
  evidence_attachment_id TEXT,
  verified_by TEXT,
  verified_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employee_id, requirement_id)
);
CREATE INDEX idx_employee_requirements_lookup ON employee_requirements(employee_id, requirement_id, status);
