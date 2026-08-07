CREATE TABLE rotation_pools (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  group_id TEXT NOT NULL REFERENCES groups(id),
  source_level_id TEXT NOT NULL REFERENCES levels(id),
  target_level_id TEXT NOT NULL REFERENCES levels(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  UNIQUE(group_id, source_level_id, target_level_id)
);

CREATE TABLE rotation_queue_entries (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES rotation_pools(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  queue_position INTEGER NOT NULL CHECK(queue_position > 0),
  status TEXT NOT NULL CHECK(status IN ('AVAILABLE','UNAVAILABLE','RESERVED','ASSIGNED','SUSPENDED')),
  last_coverage_at TEXT,
  times_selected INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(pool_id, employee_id),
  UNIQUE(pool_id, queue_position)
);

CREATE TABLE rotation_events (
  id TEXT PRIMARY KEY,
  pool_id TEXT NOT NULL REFERENCES rotation_pools(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  coverage_case_id TEXT REFERENCES coverage_cases(id),
  event_type TEXT NOT NULL,
  previous_position INTEGER,
  new_position INTEGER,
  reason TEXT,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_rotation_events_pool_created ON rotation_events(pool_id, created_at);

CREATE TABLE competitions (
  id TEXT PRIMARY KEY,
  coverage_case_id TEXT NOT NULL UNIQUE REFERENCES coverage_cases(id),
  minimum_score REAL NOT NULL DEFAULT 0 CHECK(minimum_score >= 0 AND minimum_score <= 100),
  tie_breaker TEXT NOT NULL,
  registration_start TEXT,
  registration_end TEXT,
  exam_date TEXT,
  status TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE competition_candidates (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  eligibility_status TEXT NOT NULL CHECK(eligibility_status IN ('ELIGIBLE','INELIGIBLE','PENDING_REVIEW')),
  eligibility_json TEXT NOT NULL DEFAULT '{}',
  accepted_participation INTEGER CHECK(accepted_participation IN (0,1)),
  exam_score REAL CHECK(exam_score IS NULL OR (exam_score >= 0 AND exam_score <= 100)),
  rank INTEGER,
  result_status TEXT,
  UNIQUE(competition_id, employee_id)
);

CREATE TABLE competition_score_revisions (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES competition_candidates(id),
  previous_score REAL,
  new_score REAL NOT NULL CHECK(new_score >= 0 AND new_score <= 100),
  reason TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
