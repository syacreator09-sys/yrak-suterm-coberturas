ALTER TABLE coverage_cases ADD COLUMN parent_coverage_case_id TEXT REFERENCES coverage_cases(id);
ALTER TABLE coverage_cases ADD COLUMN root_coverage_case_id TEXT REFERENCES coverage_cases(id);
ALTER TABLE coverage_cases ADD COLUMN chain_order INTEGER NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX idx_coverage_single_cascade_child ON coverage_cases(parent_coverage_case_id) WHERE parent_coverage_case_id IS NOT NULL;
CREATE INDEX idx_coverage_root_chain ON coverage_cases(root_coverage_case_id, chain_order);
