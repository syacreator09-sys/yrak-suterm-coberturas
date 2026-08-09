ALTER TABLE temporary_assignments ADD COLUMN offer_expires_at TEXT;
ALTER TABLE temporary_assignments ADD COLUMN offer_token_hash TEXT;
ALTER TABLE temporary_assignments ADD COLUMN offer_notified_at TEXT;
CREATE INDEX idx_assignments_offer_expiry ON temporary_assignments(status, offer_expires_at);
