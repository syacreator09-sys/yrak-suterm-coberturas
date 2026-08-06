PRAGMA foreign_keys = ON;

ALTER TABLE coverage_cases ADD COLUMN actual_started_at TEXT;
ALTER TABLE coverage_cases ADD COLUMN actual_ended_at TEXT;
ALTER TABLE temporary_assignments ADD COLUMN actual_started_at TEXT;
ALTER TABLE temporary_assignments ADD COLUMN actual_ended_at TEXT;
