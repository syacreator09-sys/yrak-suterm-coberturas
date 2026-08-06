PRAGMA foreign_keys = ON;

CREATE TABLE appeal_cases (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE RESTRICT,
  coverage_case_id TEXT NOT NULL REFERENCES coverage_cases(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  evidence_attachment_id TEXT REFERENCES attachments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (
    status IN ('SUBMITTED','UNDER_REVIEW','UPHELD','DISMISSED','WITHDRAWN')
  ),
  submitted_by TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_by TEXT REFERENCES app_users(id) ON DELETE RESTRICT,
  decided_at TEXT,
  decision_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (status IN ('SUBMITTED','UNDER_REVIEW','WITHDRAWN') AND decided_by IS NULL AND decided_at IS NULL)
    OR
    (status IN ('UPHELD','DISMISSED') AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND decision_reason IS NOT NULL)
  )
);

CREATE INDEX idx_appeals_org_status ON appeal_cases(organization_id, status, submitted_at DESC);
CREATE INDEX idx_appeals_competition ON appeal_cases(competition_id, submitted_at DESC);

CREATE TRIGGER appeal_cases_scope_insert
BEFORE INSERT ON appeal_cases
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM competitions c
    JOIN coverage_cases cc ON cc.id = c.coverage_case_id
    JOIN groups g ON g.id = cc.group_id
    JOIN employees e ON e.organization_id = g.organization_id
    WHERE c.id = NEW.competition_id
      AND cc.id = NEW.coverage_case_id
      AND e.id = NEW.employee_id
      AND g.organization_id = NEW.organization_id
  ) THEN RAISE(ABORT, 'appeal entities outside organization') END;
  SELECT CASE WHEN NEW.evidence_attachment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM attachments a
    WHERE a.id = NEW.evidence_attachment_id AND a.organization_id = NEW.organization_id
  ) THEN RAISE(ABORT, 'appeal evidence outside organization') END;
END;

CREATE TRIGGER appeal_cases_identity_no_update
BEFORE UPDATE OF organization_id, competition_id, coverage_case_id, employee_id, submitted_by, submitted_at
ON appeal_cases
BEGIN
  SELECT RAISE(ABORT, 'appeal identity is immutable');
END;

CREATE TABLE appeal_events (
  id TEXT PRIMARY KEY,
  appeal_id TEXT NOT NULL REFERENCES appeal_cases(id) ON DELETE RESTRICT,
  actor_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('SUBMITTED','REVIEW_STARTED','UPHELD','DISMISSED','WITHDRAWN','NOTE_ADDED')),
  reason TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER appeal_events_no_update
BEFORE UPDATE ON appeal_events
BEGIN
  SELECT RAISE(ABORT, 'appeal_events is append-only');
END;

CREATE TRIGGER appeal_events_no_delete
BEFORE DELETE ON appeal_events
BEGIN
  SELECT RAISE(ABORT, 'appeal_events is append-only');
END;
