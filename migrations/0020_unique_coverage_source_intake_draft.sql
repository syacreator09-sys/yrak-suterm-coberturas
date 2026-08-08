-- A reviewed Intake draft may create at most one coverage case per organization.
-- This is a database-level idempotency invariant for concurrent/retried consume requests.
CREATE UNIQUE INDEX IF NOT EXISTS ux_coverage_cases_source_intake_draft
  ON coverage_cases(organization_id, source_intake_draft_id)
  WHERE source_intake_draft_id IS NOT NULL;
