PRAGMA foreign_keys = ON;

CREATE TABLE absences (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('DRAFT','CONFIRMED','CANCELLED')),
  source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL','EMAIL','AUDIO','IMAGE','DOCUMENT','INTEGRATION')),
  created_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (ends_at >= starts_at)
);

CREATE TABLE coverage_cases (
  id TEXT PRIMARY KEY,
  folio TEXT NOT NULL UNIQUE,
  absence_id TEXT NOT NULL REFERENCES absences(id) ON DELETE RESTRICT,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  vacant_level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days >= 1),
  process_type TEXT NOT NULL CHECK (process_type IN ('ROTATION','COMPETITION')),
  status TEXT NOT NULL CHECK (status IN ('DRAFT','PENDING_INFORMATION','PENDING_VALIDATION','CANDIDATES_CALCULATED','PENDING_APPROVAL','ROTATION_ASSIGNED','COMPETITION_OPEN','EXAM_PENDING','RESULT_PENDING','AWARDED','SCHEDULED','ACTIVE','COMPLETED','CANCELLED','DISPUTED')),
  rule_version TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (ends_at >= starts_at),
  CHECK ((duration_days <= 5 AND process_type = 'ROTATION') OR (duration_days >= 6 AND process_type = 'COMPETITION'))
);

CREATE TABLE temporary_assignments (
  id TEXT PRIMARY KEY,
  coverage_case_id TEXT NOT NULL REFERENCES coverage_cases(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  base_level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  target_level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  chain_order INTEGER NOT NULL CHECK (chain_order >= 1),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PROPOSED','APPROVED','SCHEDULED','ACTIVE','COMPLETED','CANCELLED','REPLACED')),
  returned_at TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  approved_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (base_level_id <> target_level_id),
  CHECK (ends_at >= starts_at),
  UNIQUE (coverage_case_id, chain_order)
);

CREATE INDEX idx_coverage_cases_group_status ON coverage_cases(group_id, status, starts_at);
CREATE INDEX idx_assignments_employee_period ON temporary_assignments(employee_id, starts_at, ends_at, status);
