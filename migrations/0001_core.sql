PRAGMA foreign_keys = ON;

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organization_id, name)
);

CREATE TABLE levels (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  level_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  rank_order INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  UNIQUE(group_id, level_number)
);

CREATE TABLE level_transitions (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  source_level_id TEXT NOT NULL REFERENCES levels(id),
  target_level_id TEXT NOT NULL REFERENCES levels(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  UNIQUE(group_id, source_level_id, target_level_id),
  CHECK(source_level_id <> target_level_id)
);

CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  base_level_id TEXT NOT NULL REFERENCES levels(id),
  employee_number TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  seniority_date TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organization_id, employee_number)
);

CREATE INDEX idx_employees_group_level ON employees(organization_id, group_id, base_level_id, active);

CREATE TABLE employee_unavailability (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  kind TEXT NOT NULL CHECK(kind IN ('VACATION','SICK_LEAVE','PERMISSION','OTHER_ASSIGNMENT','MANUAL_BLOCK','OTHER')),
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK(ends_on >= starts_on)
);
CREATE INDEX idx_unavailability_employee_period ON employee_unavailability(employee_id, starts_on, ends_on);
