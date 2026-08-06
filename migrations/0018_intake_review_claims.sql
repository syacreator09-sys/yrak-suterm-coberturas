PRAGMA foreign_keys = ON;

DROP TRIGGER IF EXISTS intake_drafts_status_guard;

CREATE TRIGGER intake_drafts_status_guard
BEFORE UPDATE OF status ON intake_drafts
WHEN NOT (
  (OLD.status = 'REVIEW_PENDING' AND NEW.status IN ('APPROVED','REJECTED','FAILED'))
  OR
  (OLD.status = NEW.status)
)
BEGIN
  SELECT RAISE(ABORT, 'invalid intake draft status transition');
END;

CREATE TABLE intake_review_claims (
  draft_id TEXT PRIMARY KEY REFERENCES intake_drafts(id) ON DELETE CASCADE,
  claimed_by TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_intake_review_claims_expiry ON intake_review_claims(expires_at);
