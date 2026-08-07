CREATE TABLE group_shift_dates (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  shift_date TEXT NOT NULL,
  scheduled INTEGER NOT NULL DEFAULT 1 CHECK(scheduled IN (0,1)),
  shift_code TEXT,
  UNIQUE(group_id, shift_date)
);

CREATE TABLE mcp_access_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  tool_name TEXT NOT NULL,
  arguments_json TEXT NOT NULL,
  requested_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_group_shift_dates ON group_shift_dates(group_id, shift_date, scheduled);
