const statements = [
  `INSERT OR IGNORE INTO organizations (id, name, timezone) VALUES ('ORG-DEMO', 'YRAK Demo', 'America/Mexico_City')`,
  `INSERT OR IGNORE INTO groups (id, organization_id, name, active) VALUES ('GROUP-1', 'ORG-DEMO', 'Grupo 1', 1)`,
  `INSERT OR IGNORE INTO groups (id, organization_id, name, active) VALUES ('GROUP-2', 'ORG-DEMO', 'Grupo 2', 1)`,
  ...['5', '6', '7', '8'].flatMap((number) => [
    `INSERT OR IGNORE INTO levels (id, group_id, level_number, name, rank_order) VALUES ('G1-L${number}', 'GROUP-1', ${number}, 'Nivel ${number}', ${number})`,
    `INSERT OR IGNORE INTO levels (id, group_id, level_number, name, rank_order) VALUES ('G2-L${number}', 'GROUP-2', ${number}, 'Nivel ${number}', ${number})`,
  ]),
  `INSERT OR IGNORE INTO level_transitions (id, group_id, source_level_id, target_level_id) VALUES ('G1-7-8', 'GROUP-1', 'G1-L7', 'G1-L8')`,
  `INSERT OR IGNORE INTO level_transitions (id, group_id, source_level_id, target_level_id) VALUES ('G1-6-7', 'GROUP-1', 'G1-L6', 'G1-L7')`,
  `INSERT OR IGNORE INTO level_transitions (id, group_id, source_level_id, target_level_id) VALUES ('G1-5-6', 'GROUP-1', 'G1-L5', 'G1-L6')`,
];

console.log(statements.join(';\n') + ';');
console.log('\nEjecuta la salida con Wrangler D1 en el ambiente deseado.');
