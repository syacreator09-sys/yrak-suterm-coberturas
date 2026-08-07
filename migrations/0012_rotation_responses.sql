CREATE TABLE coverage_candidate_responses (
  id TEXT PRIMARY KEY,
  coverage_case_id TEXT NOT NULL REFERENCES coverage_cases(id),
  employee_id TEXT NOT NULL REFERENCES employees(id),
  response TEXT NOT NULL CHECK(response IN ('DECLINED','ACCEPTED')),
  reason TEXT,
  responded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(coverage_case_id, employee_id)
);
CREATE INDEX idx_candidate_responses_case ON coverage_candidate_responses(coverage_case_id, response);
