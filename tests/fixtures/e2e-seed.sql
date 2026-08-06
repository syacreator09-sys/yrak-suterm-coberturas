PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO organizations (id, name, timezone, active)
VALUES ('ORG-DEMO', 'Organización E2E', 'America/Mexico_City', 1);

INSERT OR IGNORE INTO groups (id, organization_id, name, description, active)
VALUES ('GROUP-E2E', 'ORG-DEMO', 'Grupo E2E', 'Grupo para pruebas funcionales', 1);

INSERT OR IGNORE INTO levels (id, group_id, level_number, name, rank_order, active)
VALUES
  ('LEVEL-7-E2E', 'GROUP-E2E', 7, 'Nivel 7', 7, 1),
  ('LEVEL-8-E2E', 'GROUP-E2E', 8, 'Nivel 8', 8, 1);

INSERT OR IGNORE INTO level_transitions (
  id, group_id, source_level_id, target_level_id, active
) VALUES (
  'TRANSITION-7-8-E2E', 'GROUP-E2E', 'LEVEL-7-E2E', 'LEVEL-8-E2E', 1
);

INSERT OR IGNORE INTO employees (
  id, organization_id, group_id, base_level_id, employee_number, name,
  email, seniority_date, active
) VALUES
  (
    'EMP-8-ABSENT-E2E', 'ORG-DEMO', 'GROUP-E2E', 'LEVEL-8-E2E',
    'E2E-800', 'Persona nivel 8', 'nivel8@example.com', '2010-01-01T00:00:00.000Z', 1
  ),
  (
    'EMP-7-A-E2E', 'ORG-DEMO', 'GROUP-E2E', 'LEVEL-7-E2E',
    'E2E-701', 'Candidata A nivel 7', 'nivel7a@example.com', '2011-01-01T00:00:00.000Z', 1
  ),
  (
    'EMP-7-B-E2E', 'ORG-DEMO', 'GROUP-E2E', 'LEVEL-7-E2E',
    'E2E-702', 'Candidato B nivel 7', 'nivel7b@example.com', '2012-01-01T00:00:00.000Z', 1
  );
