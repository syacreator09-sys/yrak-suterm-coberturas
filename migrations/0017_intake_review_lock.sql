PRAGMA foreign_keys = ON;

DROP TRIGGER IF EXISTS intake_drafts_status_guard;

CREATE TRIGGER intake_drafts_status_guard
BEFORE UPDATE OF status ON intake_drafts
WHEN NOT (
  (OLD.status = 'REVIEW_PENDING' AND NEW.status IN ('REVIEWING','REJECTED','FAILED'))
  OR
  (OLD.status = 'REVIEWING' AND NEW.status IN ('APPROVED','REVIEW_PENDING','FAILED'))
  OR
  (OLD.status = NEW.status)
)
BEGIN
  SELECT RAISE(ABORT, 'invalid intake draft status transition');
END;

CREATE INDEX IF NOT EXISTS idx_intake_reviewing_updated
  ON intake_drafts(status, updated_at)
  WHERE status = 'REVIEWING';
