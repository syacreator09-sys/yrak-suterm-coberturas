PRAGMA foreign_keys = ON;

CREATE TABLE organization_policies (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  short_coverage_maximum_days INTEGER NOT NULL DEFAULT 5 CHECK (short_coverage_maximum_days >= 1),
  long_coverage_minimum_days INTEGER NOT NULL DEFAULT 6 CHECK (long_coverage_minimum_days >= 2),
  day_counting_mode TEXT NOT NULL DEFAULT 'CALENDAR_DAYS' CHECK (day_counting_mode IN ('CALENDAR_DAYS','WORKING_DAYS','SHIFTS')),
  justified_unavailability_keeps_position INTEGER NOT NULL DEFAULT 1 CHECK (justified_unavailability_keeps_position IN (0,1)),
  voluntary_rejection_consumes_turn INTEGER NOT NULL DEFAULT 1 CHECK (voluntary_rejection_consumes_turn IN (0,1)),
  cancellation_before_start_consumes_turn INTEGER NOT NULL DEFAULT 0 CHECK (cancellation_before_start_consumes_turn IN (0,1)),
  default_minimum_exam_score REAL NOT NULL DEFAULT 0 CHECK (default_minimum_exam_score >= 0 AND default_minimum_exam_score <= 100),
  default_tie_breaker_rules_json TEXT NOT NULL DEFAULT '[{"type":"CRITICAL_SECTION"},{"type":"SENIORITY"},{"type":"EMPLOYEE_ID"}]',
  updated_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (long_coverage_minimum_days = short_coverage_maximum_days + 1)
);

CREATE TABLE competition_score_revisions (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL REFERENCES competition_candidates(id) ON DELETE CASCADE,
  exam_score REAL NOT NULL CHECK (exam_score >= 0 AND exam_score <= 100),
  critical_section_score REAL CHECK (critical_section_score IS NULL OR (critical_section_score >= 0 AND critical_section_score <= 100)),
  entered_by TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  approved_by TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  supersedes_revision_id TEXT REFERENCES competition_score_revisions(id) ON DELETE RESTRICT,
  correction_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_score_revisions_candidate ON competition_score_revisions(candidate_id, created_at DESC);

CREATE TRIGGER competition_score_revisions_no_update
BEFORE UPDATE ON competition_score_revisions
BEGIN
  SELECT RAISE(ABORT, 'competition_score_revisions is append-only');
END;

CREATE TRIGGER competition_score_revisions_no_delete
BEFORE DELETE ON competition_score_revisions
BEGIN
  SELECT RAISE(ABORT, 'competition_score_revisions is append-only');
END;
