CREATE TRIGGER IF NOT EXISTS rotation_pool_requires_transition
BEFORE INSERT ON rotation_pools
WHEN NOT EXISTS (
  SELECT 1
    FROM level_transitions lt
   WHERE lt.group_id = NEW.group_id
     AND lt.source_level_id = NEW.source_level_id
     AND lt.target_level_id = NEW.target_level_id
     AND lt.active = 1
)
BEGIN
  SELECT RAISE(ABORT, 'ROTATION_POOL_TRANSITION_NOT_AUTHORIZED');
END;

CREATE TRIGGER IF NOT EXISTS temporary_assignment_requires_transition
BEFORE INSERT ON temporary_assignments
WHEN NOT EXISTS (
  SELECT 1
    FROM coverage_cases c
    JOIN level_transitions lt
      ON lt.group_id = c.group_id
     AND lt.source_level_id = NEW.base_level_id
     AND lt.target_level_id = NEW.target_level_id
     AND lt.active = 1
   WHERE c.id = NEW.coverage_case_id
)
BEGIN
  SELECT RAISE(ABORT, 'TEMPORARY_ASSIGNMENT_TRANSITION_NOT_AUTHORIZED');
END;
