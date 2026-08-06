PRAGMA foreign_keys = ON;

CREATE TABLE competitions (
  id TEXT PRIMARY KEY,
  coverage_case_id TEXT NOT NULL UNIQUE REFERENCES coverage_cases(id) ON DELETE RESTRICT,
  target_level_id TEXT NOT NULL REFERENCES levels(id) ON DELETE RESTRICT,
  registration_starts_at TEXT NOT NULL,
  registration_ends_at TEXT NOT NULL,
  exam_at TEXT,
  minimum_score REAL NOT NULL DEFAULT 0 CHECK (minimum_score >= 0 AND minimum_score <= 100),
  tie_breaker_rules_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','OPEN','REGISTRATION_CLOSED','EXAM_PENDING','SCORING','RESULT_PROVISIONAL','DISPUTED','FINAL','CANCELLED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (registration_ends_at >= registration_starts_at)
);

CREATE TABLE competition_candidates (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  eligibility_status TEXT NOT NULL CHECK (eligibility_status IN ('ELIGIBLE','INELIGIBLE','PENDING_REVIEW')),
  eligibility_details_json TEXT NOT NULL,
  accepted_participation INTEGER CHECK (accepted_participation IN (0, 1)),
  accepted_at TEXT,
  result_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (result_status IN ('PENDING','WITHDRAWN','DISQUALIFIED','WINNER','RUNNER_UP','NOT_SELECTED')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (competition_id, employee_id)
);

CREATE TABLE competition_scores (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL UNIQUE REFERENCES competition_candidates(id) ON DELETE CASCADE,
  exam_score REAL NOT NULL CHECK (exam_score >= 0 AND exam_score <= 100),
  critical_section_score REAL CHECK (critical_section_score IS NULL OR (critical_section_score >= 0 AND critical_section_score <= 100)),
  final_score REAL NOT NULL CHECK (final_score >= 0 AND final_score <= 100),
  rank INTEGER CHECK (rank IS NULL OR rank >= 1),
  entered_by TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  entered_at TEXT NOT NULL DEFAULT (datetime('now')),
  corrected_from_score_id TEXT REFERENCES competition_scores(id) ON DELETE RESTRICT,
  correction_reason TEXT,
  approved_by TEXT REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE TABLE competition_appeals (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE RESTRICT,
  candidate_id TEXT NOT NULL REFERENCES competition_candidates(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN','UNDER_REVIEW','UPHELD','REJECTED','WITHDRAWN')),
  resolution TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by TEXT REFERENCES app_users(id) ON DELETE SET NULL
);

CREATE INDEX idx_competition_candidates_status ON competition_candidates(competition_id, eligibility_status, result_status);
