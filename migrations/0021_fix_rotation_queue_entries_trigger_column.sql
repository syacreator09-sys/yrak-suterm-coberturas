-- Fix two triggers from 0016_derived_state_invalidation.sql that reference a
-- non-existent `updated_at` column on `rotation_queue_entries` (that table
-- only tracks freshness via `version`, it never had an `updated_at` column —
-- see 0004_rotation_competition.sql). SQLite validates an AFTER UPDATE OF
-- trigger's body against the schema at *statement-prepare* time for any
-- INSERT ... ON CONFLICT DO UPDATE whose SET list touches a column the
-- trigger watches — so every call to POST /v1/import/employees (which always
-- sets group_id, base_level_id and active in its DO UPDATE clause) fails with
-- "no such column: updated_at", even on a brand-new INSERT with no actual
-- conflict, because the DO UPDATE branch is still compiled and its
-- consequential trigger bodies statically checked. Discovered while running
-- scripts/demo/seed-demo.sh (Task B2) against the demo environment; the same
-- broken trigger ships in production (0016 already applied there), so any
-- write path that upserts employees is dormant-broken there too.

DROP TRIGGER IF EXISTS employee_structure_change_suspends_stale_queues;

CREATE TRIGGER employee_structure_change_suspends_stale_queues
AFTER UPDATE OF group_id, base_level_id ON employees
WHEN OLD.group_id IS NOT NEW.group_id OR OLD.base_level_id IS NOT NEW.base_level_id
BEGIN
  UPDATE rotation_queue_entries
     SET status = 'SUSPENDED',
         version = version + 1
   WHERE employee_id = NEW.id
     AND pool_id IN (
       SELECT id
         FROM rotation_pools
        WHERE group_id <> NEW.group_id
           OR source_level_id <> NEW.base_level_id
     );

  UPDATE competition_candidates
     SET eligibility_status = 'PENDING_REVIEW',
         rank = NULL,
         result_status = NULL
   WHERE employee_id = NEW.id
     AND competition_id IN (
       SELECT cp.id
         FROM competitions cp
        WHERE cp.status NOT IN ('AWARDED','COMPLETED','CANCELLED')
     );
END;

DROP TRIGGER IF EXISTS employee_deactivation_suspends_queues;

CREATE TRIGGER employee_deactivation_suspends_queues
AFTER UPDATE OF active ON employees
WHEN OLD.active = 1 AND NEW.active = 0
BEGIN
  UPDATE rotation_queue_entries
     SET status = 'SUSPENDED',
         version = version + 1
   WHERE employee_id = NEW.id;

  UPDATE competition_candidates
     SET eligibility_status = 'INELIGIBLE',
         rank = NULL,
         result_status = NULL
   WHERE employee_id = NEW.id
     AND competition_id IN (
       SELECT cp.id
         FROM competitions cp
        WHERE cp.status NOT IN ('AWARDED','COMPLETED','CANCELLED')
     );
END;
