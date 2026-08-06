PRAGMA foreign_keys = ON;

CREATE TABLE competition_score_revision_approvals (
  id TEXT PRIMARY KEY,
  revision_id TEXT NOT NULL UNIQUE REFERENCES competition_score_revisions(id) ON DELETE RESTRICT,
  approved_by TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  approved_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TRIGGER competition_score_revision_approvals_no_update
BEFORE UPDATE ON competition_score_revision_approvals
BEGIN
  SELECT RAISE(ABORT, 'competition_score_revision_approvals is append-only');
END;

CREATE TRIGGER competition_score_revision_approvals_no_delete
BEFORE DELETE ON competition_score_revision_approvals
BEGIN
  SELECT RAISE(ABORT, 'competition_score_revision_approvals is append-only');
END;

CREATE INDEX idx_score_revision_approvals_revision
  ON competition_score_revision_approvals(revision_id, approved_at);
