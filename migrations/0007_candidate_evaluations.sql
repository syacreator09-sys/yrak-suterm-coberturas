CREATE TABLE coverage_candidate_evaluations (
  id TEXT PRIMARY KEY,
  coverage_case_id TEXT NOT NULL REFERENCES coverage_cases(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  process_type TEXT NOT NULL CHECK(process_type IN ('ROTATION','COMPETITION')),
  selected INTEGER NOT NULL DEFAULT 0 CHECK(selected IN (0,1)),
  eligible INTEGER CHECK(eligible IS NULL OR eligible IN (0,1)),
  reason_codes_json TEXT NOT NULL DEFAULT '[]',
  queue_position INTEGER,
  exam_score REAL,
  rank INTEGER,
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_candidate_evaluations_case ON coverage_candidate_evaluations(coverage_case_id, created_at);
