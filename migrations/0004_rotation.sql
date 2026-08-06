PRAGMA foreign_keys = ON;

CREATE TABLE rotation_pools (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  source_level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  target_level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (group_id, source_level_id, target_level_id)
);

CREATE TABLE rotation_queue_entries (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES rotation_pools(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  queue_position INTEGER NOT NULL CHECK (queue_position >= 1),
  availability TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (availability IN ('AVAILABLE','UNAVAILABLE','RESERVED','ASSIGNED','SUSPENDED')),
  unavailable_reason TEXT,
  last_coverage_at TEXT,
  times_selected INTEGER NOT NULL DEFAULT 0 CHECK (times_selected >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (pool_id, employee_id),
  UNIQUE (pool_id, queue_position)
);

CREATE TABLE rotation_events (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES rotation_pools(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  coverage_case_id TEXT REFERENCES coverage_cases(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('ADDED_TO_QUEUE','SKIPPED','SELECTED','RESERVED','MOVED_TO_END','TEMPORARILY_BLOCKED','RESTORED','REMOVED','MANUALLY_ADJUSTED')),
  previous_position INTEGER,
  new_position INTEGER,
  reason TEXT,
  created_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_rotation_queue_pool_position ON rotation_queue_entries(pool_id, queue_position);
CREATE INDEX idx_rotation_events_case ON rotation_events(coverage_case_id, created_at);
