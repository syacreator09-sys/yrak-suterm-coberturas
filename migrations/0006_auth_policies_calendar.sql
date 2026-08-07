CREATE TABLE users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN','HR','SUPERVISOR','COMMITTEE','OPERATOR','EMPLOYEE','AUDITOR')),
  employee_id TEXT REFERENCES employees(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organization_id, email)
);

CREATE TABLE user_groups (
  user_id TEXT NOT NULL REFERENCES users(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  PRIMARY KEY(user_id, group_id)
);

CREATE TABLE group_policies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  group_id TEXT REFERENCES groups(id),
  policy_key TEXT NOT NULL,
  version INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(organization_id, group_id, policy_key, version)
);

CREATE TABLE holidays (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  group_id TEXT REFERENCES groups(id),
  holiday_date TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(organization_id, group_id, holiday_date)
);

CREATE TABLE employee_shifts (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  shift_date TEXT NOT NULL,
  shift_code TEXT,
  scheduled INTEGER NOT NULL DEFAULT 1 CHECK(scheduled IN (0,1)),
  UNIQUE(employee_id, shift_date)
);

CREATE TABLE intake_drafts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  source_type TEXT NOT NULL CHECK(source_type IN ('TEXT','EMAIL','AUDIO','IMAGE','PDF','SPREADSHEET')),
  source_attachment_id TEXT REFERENCES attachments(id),
  extracted_json TEXT NOT NULL,
  confidence REAL,
  status TEXT NOT NULL CHECK(status IN ('PENDING_REVIEW','APPROVED','REJECTED','CONSUMED')),
  created_by TEXT NOT NULL,
  reviewed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);
