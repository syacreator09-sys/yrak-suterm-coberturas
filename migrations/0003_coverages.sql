CREATE TABLE rule_versions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  config_json TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE coverage_cases (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  target_level_id TEXT NOT NULL REFERENCES levels(id),
  reason TEXT,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  effective_days INTEGER NOT NULL CHECK(effective_days > 0),
  day_counting_mode TEXT NOT NULL CHECK(day_counting_mode IN ('CALENDAR_DAYS','WORKING_DAYS','SHIFTS')),
  counted_dates_json TEXT NOT NULL DEFAULT '[]',
  process_type TEXT NOT NULL CHECK(process_type IN ('ROTATION','COMPETITION')),
  status TEXT NOT NULL,
  rule_version_id TEXT NOT NULL REFERENCES rule_versions(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(ends_on >= starts_on)
);
CREATE INDEX idx_coverage_cases_group_period ON coverage_cases(organization_id, group_id, starts_on, ends_on, status);

CREATE TABLE temporary_assignments (
  id TEXT PRIMARY KEY,
  coverage_case_id TEXT NOT NULL REFERENCES coverage_cases(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  base_level_id TEXT NOT NULL REFERENCES levels(id),
  target_level_id TEXT NOT NULL REFERENCES levels(id),
  chain_order INTEGER NOT NULL DEFAULT 1,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PROPOSED','APPROVED','SCHEDULED','ACTIVE','COMPLETED','CANCELLED','REPLACED')),
  returned_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(ends_on >= starts_on)
);
CREATE INDEX idx_assignments_employee_period ON temporary_assignments(employee_id, starts_on, ends_on, status);
