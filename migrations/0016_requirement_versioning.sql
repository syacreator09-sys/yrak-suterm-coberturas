PRAGMA foreign_keys = ON;

CREATE TRIGGER requirements_definition_immutable
BEFORE UPDATE OF name, requirement_type, validity_days, organization_id ON requirements
WHEN NEW.name <> OLD.name
  OR NEW.requirement_type <> OLD.requirement_type
  OR COALESCE(NEW.validity_days, -1) <> COALESCE(OLD.validity_days, -1)
  OR NEW.organization_id <> OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'requirement definitions are immutable; create a new version');
END;

CREATE TABLE requirement_replacements (
  old_requirement_id TEXT PRIMARY KEY REFERENCES requirements(id) ON DELETE RESTRICT,
  new_requirement_id TEXT NOT NULL UNIQUE REFERENCES requirements(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  replaced_by TEXT NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  replaced_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (old_requirement_id <> new_requirement_id)
);

CREATE TRIGGER requirement_replacements_scope_insert
BEFORE INSERT ON requirement_replacements
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM requirements old
    JOIN requirements replacement ON replacement.organization_id = old.organization_id
    WHERE old.id = NEW.old_requirement_id AND replacement.id = NEW.new_requirement_id
  ) THEN RAISE(ABORT, 'replacement requirement outside organization') END;
END;

CREATE TRIGGER requirement_replacements_no_update
BEFORE UPDATE ON requirement_replacements
BEGIN
  SELECT RAISE(ABORT, 'requirement replacement history is immutable');
END;

CREATE TRIGGER requirement_replacements_no_delete
BEFORE DELETE ON requirement_replacements
BEGIN
  SELECT RAISE(ABORT, 'requirement replacement history is immutable');
END;
