-- Employee base level must belong to the employee group and organization.
CREATE TRIGGER IF NOT EXISTS employee_structure_guard_insert
BEFORE INSERT ON employees
WHEN NOT EXISTS (
  SELECT 1
    FROM groups g
    JOIN levels l ON l.group_id = g.id
   WHERE g.id = NEW.group_id
     AND l.id = NEW.base_level_id
     AND g.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'EMPLOYEE_GROUP_LEVEL_MISMATCH');
END;

CREATE TRIGGER IF NOT EXISTS employee_structure_guard_update
BEFORE UPDATE OF organization_id, group_id, base_level_id ON employees
WHEN NOT EXISTS (
  SELECT 1
    FROM groups g
    JOIN levels l ON l.group_id = g.id
   WHERE g.id = NEW.group_id
     AND l.id = NEW.base_level_id
     AND g.organization_id = NEW.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'EMPLOYEE_GROUP_LEVEL_MISMATCH');
END;

-- Level transitions cannot be self loops or cross-group references.
CREATE TRIGGER IF NOT EXISTS level_transition_guard_insert
BEFORE INSERT ON level_transitions
WHEN NEW.source_level_id = NEW.target_level_id
   OR NOT EXISTS (
     SELECT 1 FROM levels s
     JOIN levels t ON t.id = NEW.target_level_id
     WHERE s.id = NEW.source_level_id
       AND s.group_id = NEW.group_id
       AND t.group_id = NEW.group_id
   )
BEGIN
  SELECT RAISE(ABORT, 'INVALID_LEVEL_TRANSITION');
END;

CREATE TRIGGER IF NOT EXISTS level_transition_guard_update
BEFORE UPDATE OF group_id, source_level_id, target_level_id ON level_transitions
WHEN NEW.source_level_id = NEW.target_level_id
   OR NOT EXISTS (
     SELECT 1 FROM levels s
     JOIN levels t ON t.id = NEW.target_level_id
     WHERE s.id = NEW.source_level_id
       AND s.group_id = NEW.group_id
       AND t.group_id = NEW.group_id
   )
BEGIN
  SELECT RAISE(ABORT, 'INVALID_LEVEL_TRANSITION');
END;

-- A rotation pool is only valid for two levels of the same group/org.
CREATE TRIGGER IF NOT EXISTS rotation_pool_structure_guard_insert
BEFORE INSERT ON rotation_pools
WHEN NEW.source_level_id = NEW.target_level_id
   OR NOT EXISTS (
     SELECT 1
       FROM groups g
       JOIN levels s ON s.group_id = g.id
       JOIN levels t ON t.group_id = g.id
      WHERE g.id = NEW.group_id
        AND g.organization_id = NEW.organization_id
        AND s.id = NEW.source_level_id
        AND t.id = NEW.target_level_id
   )
BEGIN
  SELECT RAISE(ABORT, 'INVALID_ROTATION_POOL_STRUCTURE');
END;

-- Queue members must actually be active members of the pool's source level.
CREATE TRIGGER IF NOT EXISTS rotation_queue_member_guard_insert
BEFORE INSERT ON rotation_queue_entries
WHEN NOT EXISTS (
  SELECT 1
    FROM rotation_pools p
    JOIN employees e ON e.id = NEW.employee_id
   WHERE p.id = NEW.pool_id
     AND e.organization_id = p.organization_id
     AND e.group_id = p.group_id
     AND e.base_level_id = p.source_level_id
)
BEGIN
  SELECT RAISE(ABORT, 'ROTATION_QUEUE_EMPLOYEE_MISMATCH');
END;

CREATE TRIGGER IF NOT EXISTS rotation_queue_member_guard_update
BEFORE UPDATE OF pool_id, employee_id ON rotation_queue_entries
WHEN NOT EXISTS (
  SELECT 1
    FROM rotation_pools p
    JOIN employees e ON e.id = NEW.employee_id
   WHERE p.id = NEW.pool_id
     AND e.organization_id = p.organization_id
     AND e.group_id = p.group_id
     AND e.base_level_id = p.source_level_id
)
BEGIN
  SELECT RAISE(ABORT, 'ROTATION_QUEUE_EMPLOYEE_MISMATCH');
END;

-- Requirement and target level must belong to the same organization.
CREATE TRIGGER IF NOT EXISTS target_requirement_scope_guard_insert
BEFORE INSERT ON target_level_requirements
WHEN NOT EXISTS (
  SELECT 1
    FROM levels l
    JOIN groups g ON g.id = l.group_id
    JOIN requirements r ON r.id = NEW.requirement_id
   WHERE l.id = NEW.target_level_id
     AND r.organization_id = g.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'TARGET_REQUIREMENT_ORGANIZATION_MISMATCH');
END;

CREATE TRIGGER IF NOT EXISTS target_requirement_scope_guard_update
BEFORE UPDATE OF target_level_id, requirement_id ON target_level_requirements
WHEN NOT EXISTS (
  SELECT 1
    FROM levels l
    JOIN groups g ON g.id = l.group_id
    JOIN requirements r ON r.id = NEW.requirement_id
   WHERE l.id = NEW.target_level_id
     AND r.organization_id = g.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'TARGET_REQUIREMENT_ORGANIZATION_MISMATCH');
END;

-- User group assignments cannot cross organizations.
CREATE TRIGGER IF NOT EXISTS user_group_scope_guard_insert
BEFORE INSERT ON user_groups
WHEN NOT EXISTS (
  SELECT 1
    FROM users u
    JOIN groups g ON g.id = NEW.group_id
   WHERE u.id = NEW.user_id
     AND u.organization_id = g.organization_id
)
BEGIN
  SELECT RAISE(ABORT, 'USER_GROUP_ORGANIZATION_MISMATCH');
END;

-- Coverage target level must be a level in the stated group/org.
CREATE TRIGGER IF NOT EXISTS coverage_structure_guard_insert
BEFORE INSERT ON coverage_cases
WHEN NOT EXISTS (
  SELECT 1
    FROM groups g
    JOIN levels l ON l.group_id = g.id
   WHERE g.id = NEW.group_id
     AND g.organization_id = NEW.organization_id
     AND l.id = NEW.target_level_id
)
BEGIN
  SELECT RAISE(ABORT, 'COVERAGE_GROUP_LEVEL_MISMATCH');
END;

-- Every assignment must preserve the employee's current base level and target
-- the exact level of its coverage case.
CREATE TRIGGER IF NOT EXISTS temporary_assignment_structure_guard_insert
BEFORE INSERT ON temporary_assignments
WHEN NOT EXISTS (
  SELECT 1
    FROM coverage_cases c
    JOIN employees e ON e.id = NEW.employee_id
   WHERE c.id = NEW.coverage_case_id
     AND e.organization_id = c.organization_id
     AND e.group_id = c.group_id
     AND e.base_level_id = NEW.base_level_id
     AND c.target_level_id = NEW.target_level_id
)
BEGIN
  SELECT RAISE(ABORT, 'TEMPORARY_ASSIGNMENT_STRUCTURE_MISMATCH');
END;
