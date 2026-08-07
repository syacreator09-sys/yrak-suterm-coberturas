CREATE TRIGGER IF NOT EXISTS employee_requirement_insert_requires_reevaluation
AFTER INSERT ON employee_requirements
BEGIN
  UPDATE competition_candidates
     SET eligibility_status = 'PENDING_REVIEW',
         rank = NULL,
         result_status = NULL
   WHERE employee_id = NEW.employee_id
     AND competition_id IN (
       SELECT cp.id
         FROM competitions cp
        WHERE cp.status NOT IN ('AWARDED','COMPLETED','CANCELLED')
     );
END;

CREATE TRIGGER IF NOT EXISTS employee_requirement_delete_requires_reevaluation
AFTER DELETE ON employee_requirements
BEGIN
  UPDATE competition_candidates
     SET eligibility_status = 'PENDING_REVIEW',
         rank = NULL,
         result_status = NULL
   WHERE employee_id = OLD.employee_id
     AND competition_id IN (
       SELECT cp.id
         FROM competitions cp
        WHERE cp.status NOT IN ('AWARDED','COMPLETED','CANCELLED')
     );
END;

CREATE TRIGGER IF NOT EXISTS target_requirement_insert_requires_reevaluation
AFTER INSERT ON target_level_requirements
BEGIN
  UPDATE competition_candidates
     SET eligibility_status = 'PENDING_REVIEW',
         rank = NULL,
         result_status = NULL
   WHERE competition_id IN (
     SELECT cp.id
       FROM competitions cp
       JOIN coverage_cases cc ON cc.id = cp.coverage_case_id
      WHERE cc.target_level_id = NEW.target_level_id
        AND cp.status NOT IN ('AWARDED','COMPLETED','CANCELLED')
   );
END;

CREATE TRIGGER IF NOT EXISTS target_requirement_delete_requires_reevaluation
AFTER DELETE ON target_level_requirements
BEGIN
  UPDATE competition_candidates
     SET eligibility_status = 'PENDING_REVIEW',
         rank = NULL,
         result_status = NULL
   WHERE competition_id IN (
     SELECT cp.id
       FROM competitions cp
       JOIN coverage_cases cc ON cc.id = cp.coverage_case_id
      WHERE cc.target_level_id = OLD.target_level_id
        AND cp.status NOT IN ('AWARDED','COMPLETED','CANCELLED')
   );
END;

-- A person's current base level/group is authoritative. Existing queue
-- memberships that no longer match it are suspended instead of silently
-- remaining eligible.
CREATE TRIGGER IF NOT EXISTS employee_structure_change_suspends_stale_queues
AFTER UPDATE OF group_id, base_level_id ON employees
WHEN OLD.group_id IS NOT NEW.group_id OR OLD.base_level_id IS NOT NEW.base_level_id
BEGIN
  UPDATE rotation_queue_entries
     SET status = 'SUSPENDED',
         version = version + 1,
         updated_at = datetime('now')
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

CREATE TRIGGER IF NOT EXISTS employee_deactivation_suspends_queues
AFTER UPDATE OF active ON employees
WHEN OLD.active = 1 AND NEW.active = 0
BEGIN
  UPDATE rotation_queue_entries
     SET status = 'SUSPENDED',
         version = version + 1,
         updated_at = datetime('now')
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
