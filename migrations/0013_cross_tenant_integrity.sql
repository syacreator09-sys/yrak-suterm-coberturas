PRAGMA foreign_keys = ON;

CREATE TRIGGER employees_scope_insert
BEFORE INSERT ON employees
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM groups g JOIN levels l ON l.group_id = g.id
    WHERE g.id = NEW.group_id AND l.id = NEW.base_level_id
      AND g.organization_id = NEW.organization_id
  ) THEN RAISE(ABORT, 'employee group/level outside organization') END;
END;

CREATE TRIGGER employees_scope_update
BEFORE UPDATE OF organization_id, group_id, base_level_id ON employees
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM groups g JOIN levels l ON l.group_id = g.id
    WHERE g.id = NEW.group_id AND l.id = NEW.base_level_id
      AND g.organization_id = NEW.organization_id
  ) THEN RAISE(ABORT, 'employee group/level outside organization') END;
END;

CREATE TRIGGER app_users_employee_scope_insert
BEFORE INSERT ON app_users
WHEN NEW.employee_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = NEW.employee_id AND e.organization_id = NEW.organization_id
  ) THEN RAISE(ABORT, 'user employee outside organization') END;
END;

CREATE TRIGGER app_users_employee_scope_update
BEFORE UPDATE OF organization_id, employee_id ON app_users
WHEN NEW.employee_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = NEW.employee_id AND e.organization_id = NEW.organization_id
  ) THEN RAISE(ABORT, 'user employee outside organization') END;
END;

CREATE TRIGGER user_roles_group_scope_insert
BEFORE INSERT ON user_roles
WHEN NEW.group_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM app_users u JOIN groups g ON g.organization_id = u.organization_id
    WHERE u.id = NEW.user_id AND g.id = NEW.group_id
  ) THEN RAISE(ABORT, 'role group outside user organization') END;
END;

CREATE TRIGGER level_transitions_integrity_insert
BEFORE INSERT ON level_transitions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM levels source JOIN levels target ON target.group_id = source.group_id
    WHERE source.id = NEW.source_level_id AND target.id = NEW.target_level_id
      AND source.group_id = NEW.group_id
      AND source.rank_order < target.rank_order
      AND NOT EXISTS (
        SELECT 1 FROM levels middle
        WHERE middle.group_id = source.group_id AND middle.active = 1
          AND middle.rank_order > source.rank_order
          AND middle.rank_order < target.rank_order
      )
  ) THEN RAISE(ABORT, 'transition must use immediate lower level in same group') END;
END;

CREATE TRIGGER level_transitions_integrity_update
BEFORE UPDATE OF group_id, source_level_id, target_level_id ON level_transitions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM levels source JOIN levels target ON target.group_id = source.group_id
    WHERE source.id = NEW.source_level_id AND target.id = NEW.target_level_id
      AND source.group_id = NEW.group_id
      AND source.rank_order < target.rank_order
      AND NOT EXISTS (
        SELECT 1 FROM levels middle
        WHERE middle.group_id = source.group_id AND middle.active = 1
          AND middle.rank_order > source.rank_order
          AND middle.rank_order < target.rank_order
      )
  ) THEN RAISE(ABORT, 'transition must use immediate lower level in same group') END;
END;

CREATE TRIGGER target_level_requirements_scope_insert
BEFORE INSERT ON target_level_requirements
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM levels l JOIN groups g ON g.id = l.group_id
    JOIN requirements r ON r.organization_id = g.organization_id
    WHERE l.id = NEW.target_level_id AND r.id = NEW.requirement_id
  ) THEN RAISE(ABORT, 'requirement outside level organization') END;
END;

CREATE TRIGGER employee_requirements_scope_insert
BEFORE INSERT ON employee_requirements
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM employees e JOIN requirements r ON r.organization_id = e.organization_id
    WHERE e.id = NEW.employee_id AND r.id = NEW.requirement_id
  ) THEN RAISE(ABORT, 'requirement outside employee organization') END;
  SELECT CASE WHEN NEW.evidence_attachment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM employees e JOIN attachments a ON a.organization_id = e.organization_id
    WHERE e.id = NEW.employee_id AND a.id = NEW.evidence_attachment_id
  ) THEN RAISE(ABORT, 'evidence outside employee organization') END;
END;

CREATE TRIGGER employee_requirements_scope_update
BEFORE UPDATE OF employee_id, requirement_id, evidence_attachment_id ON employee_requirements
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM employees e JOIN requirements r ON r.organization_id = e.organization_id
    WHERE e.id = NEW.employee_id AND r.id = NEW.requirement_id
  ) THEN RAISE(ABORT, 'requirement outside employee organization') END;
  SELECT CASE WHEN NEW.evidence_attachment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM employees e JOIN attachments a ON a.organization_id = e.organization_id
    WHERE e.id = NEW.employee_id AND a.id = NEW.evidence_attachment_id
  ) THEN RAISE(ABORT, 'evidence outside employee organization') END;
END;

CREATE TRIGGER absences_integrity_insert
BEFORE INSERT ON absences
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = NEW.employee_id AND e.group_id = NEW.group_id
      AND e.base_level_id = NEW.level_id
  ) THEN RAISE(ABORT, 'absence employee/group/level mismatch') END;
END;

CREATE TRIGGER coverage_cases_integrity_insert
BEFORE INSERT ON coverage_cases
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM levels l WHERE l.id = NEW.vacant_level_id AND l.group_id = NEW.group_id
  ) THEN RAISE(ABORT, 'coverage vacant level outside group') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM absences a
    WHERE a.id = NEW.absence_id AND a.group_id = NEW.group_id AND a.level_id = NEW.vacant_level_id
  ) THEN RAISE(ABORT, 'coverage does not match absence') END;
END;

CREATE TRIGGER temporary_assignments_integrity_insert
BEFORE INSERT ON temporary_assignments
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM employees e JOIN coverage_cases cc ON cc.id = NEW.coverage_case_id
    JOIN level_transitions lt ON lt.group_id = cc.group_id
      AND lt.source_level_id = NEW.base_level_id
      AND lt.target_level_id = NEW.target_level_id
      AND lt.active = 1
    WHERE e.id = NEW.employee_id AND e.base_level_id = NEW.base_level_id
      AND e.group_id = cc.group_id
  ) THEN RAISE(ABORT, 'temporary assignment violates employee base level or transition') END;
END;

CREATE TRIGGER rotation_pools_integrity_insert
BEFORE INSERT ON rotation_pools
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM level_transitions lt
    WHERE lt.group_id = NEW.group_id AND lt.source_level_id = NEW.source_level_id
      AND lt.target_level_id = NEW.target_level_id AND lt.active = 1
  ) THEN RAISE(ABORT, 'rotation pool requires active authorized transition') END;
END;

CREATE TRIGGER competitions_integrity_insert
BEFORE INSERT ON competitions
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM coverage_cases cc
    WHERE cc.id = NEW.coverage_case_id AND cc.vacant_level_id = NEW.target_level_id
      AND cc.process_type = 'COMPETITION'
  ) THEN RAISE(ABORT, 'competition target does not match coverage') END;
END;
