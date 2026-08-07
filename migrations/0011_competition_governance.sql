ALTER TABLE competitions ADD COLUMN rules_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(rules_confirmed IN (0,1));
ALTER TABLE competitions ADD COLUMN rules_confirmed_by TEXT;
ALTER TABLE competitions ADD COLUMN rules_confirmed_at TEXT;
