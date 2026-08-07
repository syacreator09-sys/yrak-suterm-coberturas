INSERT INTO organizations (id, name, timezone) VALUES ('org-demo', 'YRAK Demo', 'America/Mexico_City');
INSERT INTO groups (id, organization_id, name) VALUES ('group-a', 'org-demo', 'Grupo A');
INSERT INTO levels (id, group_id, level_number, name, rank_order) VALUES
 ('level-5','group-a',5,'Nivel 5',5),('level-6','group-a',6,'Nivel 6',6),('level-7','group-a',7,'Nivel 7',7),('level-8','group-a',8,'Nivel 8',8);
INSERT INTO level_transitions (id, group_id, source_level_id, target_level_id) VALUES
 ('t-7-8','group-a','level-7','level-8'),('t-6-7','group-a','level-6','level-7'),('t-5-6','group-a','level-5','level-6');
INSERT INTO employees (id, organization_id, group_id, base_level_id, employee_number, name, seniority_date) VALUES
 ('emp-ana','org-demo','group-a','level-7','1001','Ana','2018-01-01'),
 ('emp-luis','org-demo','group-a','level-7','1002','Luis','2019-01-01'),
 ('emp-maria','org-demo','group-a','level-7','1003','María','2020-01-01');
INSERT INTO rotation_pools (id, organization_id, group_id, source_level_id, target_level_id) VALUES ('pool-7-8','org-demo','group-a','level-7','level-8');
INSERT INTO rotation_queue_entries (id, pool_id, employee_id, queue_position, status) VALUES
 ('rq-ana','pool-7-8','emp-ana',1,'AVAILABLE'),('rq-luis','pool-7-8','emp-luis',2,'AVAILABLE'),('rq-maria','pool-7-8','emp-maria',3,'AVAILABLE');
