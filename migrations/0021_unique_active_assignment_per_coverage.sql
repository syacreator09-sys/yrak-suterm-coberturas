-- A coverage case may have historical terminal assignments, but at most one live/proposed
-- temporary assignment at a time. Cascade children are separate coverage cases.
CREATE UNIQUE INDEX IF NOT EXISTS ux_temporary_assignments_one_live_per_coverage
  ON temporary_assignments(coverage_case_id)
  WHERE status IN ('PROPOSED','APPROVED','SCHEDULED','ACTIVE');
