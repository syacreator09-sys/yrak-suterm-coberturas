ALTER TABLE coverage_cases ADD COLUMN source_intake_draft_id TEXT REFERENCES intake_drafts(id);
CREATE UNIQUE INDEX idx_coverage_case_source_draft ON coverage_cases(source_intake_draft_id) WHERE source_intake_draft_id IS NOT NULL;
