import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppBindings } from '../env.js';
import { requireRoles, assertGroupAccess } from '../middleware.js';
import { AuditWriter } from '@yrak/audit';
import { canProvisionRole } from '../services/role-provisioning.js';

export const configurationRoutes = new Hono<AppBindings>();
configurationRoutes.use('*', requireRoles('ADMIN', 'HR'));

configurationRoutes.get('/groups', async (c) => {
  const user = c.get('user');
  const rows = await c.env.DB.prepare(`SELECT id,name,description,active FROM groups WHERE organization_id=? ORDER BY name`)
    .bind(user.organizationId).all();
  return c.json({ items: rows.results ?? [] });
});

configurationRoutes.get('/groups/:groupId/levels', async (c) => {
  await assertGroupAccess(c, c.req.param('groupId'));
  const rows = await c.env.DB.prepare(`SELECT id,level_number,name,rank_order,active FROM levels WHERE group_id=? ORDER BY rank_order`)
    .bind(c.req.param('groupId')).all();
  return c.json({ items: rows.results ?? [] });
});

configurationRoutes.get('/requirements', async (c) => {
  const user = c.get('user');
  const rows = await c.env.DB.prepare(`SELECT id,name,requirement_type,validity_days,active,version FROM requirements WHERE organization_id=? ORDER BY name`)
    .bind(user.organizationId).all();
  return c.json({ items: rows.results ?? [] });
});

configurationRoutes.get('/groups/:groupId/rotation-pools', async (c) => {
  await assertGroupAccess(c, c.req.param('groupId'));
  const rows = await c.env.DB.prepare(`SELECT p.id,p.source_level_id,p.target_level_id,p.active FROM rotation_pools p WHERE p.group_id=? ORDER BY p.id`)
    .bind(c.req.param('groupId')).all();
  return c.json({ items: rows.results ?? [] });
});

configurationRoutes.get('/rotation-pools/:poolId/queue', async (c) => {
  const user = c.get('user');
  const rows = await c.env.DB.prepare(`SELECT q.employee_id,e.employee_number,e.name,q.queue_position,q.status,q.last_coverage_at,q.times_selected
      FROM rotation_queue_entries q JOIN rotation_pools p ON p.id=q.pool_id JOIN employees e ON e.id=q.employee_id
      WHERE q.pool_id=? AND p.organization_id=? ORDER BY q.queue_position`)
    .bind(c.req.param('poolId'), user.organizationId).all();
  return c.json({ items: rows.results ?? [] });
});

configurationRoutes.get('/users', async (c) => {
  const user = c.get('user');
  const rows = await c.env.DB.prepare(`SELECT id,email,display_name,role,employee_id,active FROM users WHERE organization_id=? ORDER BY display_name`)
    .bind(user.organizationId).all();
  return c.json({ items: rows.results ?? [] });
});

configurationRoutes.post('/groups', zValidator('json', z.object({ name: z.string().min(1), description: z.string().optional() })), async (c) => {
  const user = c.get('user'), input = c.req.valid('json'), id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO groups(id,organization_id,name,description) VALUES(?,?,?,?)`)
    .bind(id, user.organizationId, input.name, input.description ?? null).run();
  await new AuditWriter(c.env.DB).append({ organizationId: user.organizationId, actorId: user.id, actorRole: user.role, entityType: 'GROUP', entityId: id, action: 'CREATED', newValue: input, correlationId: c.get('correlationId') });
  return c.json({ id, ...input }, 201);
});

configurationRoutes.post('/groups/:groupId/levels', zValidator('json', z.object({ number: z.number().int(), name: z.string().min(1), rankOrder: z.number().int() })), async (c) => {
  const user = c.get('user'), groupId = c.req.param('groupId'), input = c.req.valid('json');
  await assertGroupAccess(c, groupId);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO levels(id,group_id,level_number,name,rank_order) VALUES(?,?,?,?,?)`)
    .bind(id, groupId, input.number, input.name, input.rankOrder).run();
  await new AuditWriter(c.env.DB).append({ organizationId: user.organizationId, actorId: user.id, actorRole: user.role, entityType: 'LEVEL', entityId: id, action: 'CREATED', newValue: { groupId, ...input }, correlationId: c.get('correlationId') });
  return c.json({ id, groupId, ...input }, 201);
});

configurationRoutes.post('/groups/:groupId/transitions', zValidator('json', z.object({ sourceLevelId: z.string(), targetLevelId: z.string() })), async (c) => {
  const user = c.get('user'), groupId = c.req.param('groupId'), input = c.req.valid('json');
  await assertGroupAccess(c, groupId);
  const levels = await c.env.DB.prepare(`SELECT id FROM levels WHERE group_id=? AND id IN (?,?)`)
    .bind(groupId, input.sourceLevelId, input.targetLevelId).all();
  if ((levels.results ?? []).length !== 2) return c.json({ error: 'LEVEL_GROUP_MISMATCH' }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO level_transitions(id,group_id,source_level_id,target_level_id) VALUES(?,?,?,?)`)
    .bind(id, groupId, input.sourceLevelId, input.targetLevelId).run();
  await new AuditWriter(c.env.DB).append({ organizationId: user.organizationId, actorId: user.id, actorRole: user.role, entityType: 'LEVEL_TRANSITION', entityId: id, action: 'CREATED', newValue: { groupId, ...input }, ruleApplied: 'AUTHORIZED_LEVEL_TRANSITION', correlationId: c.get('correlationId') });
  return c.json({ id, ...input }, 201);
});

configurationRoutes.post('/requirements', zValidator('json', z.object({ name: z.string(), requirementType: z.enum(['COURSE', 'CERTIFICATION', 'PREREQUISITE_EXAM', 'DOCUMENT', 'EXPERIENCE', 'OTHER']), validityDays: z.number().int().positive().nullable().optional() })), async (c) => {
  const input = c.req.valid('json'), user = c.get('user'), id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO requirements(id,organization_id,name,requirement_type,validity_days) VALUES(?,?,?,?,?)`)
    .bind(id, user.organizationId, input.name, input.requirementType, input.validityDays ?? null).run();
  await new AuditWriter(c.env.DB).append({ organizationId: user.organizationId, actorId: user.id, actorRole: user.role, entityType: 'REQUIREMENT', entityId: id, action: 'CREATED', newValue: input, correlationId: c.get('correlationId') });
  return c.json({ id, ...input }, 201);
});

configurationRoutes.put('/levels/:levelId/requirements/:requirementId', zValidator('json', z.object({ mandatory: z.boolean().default(true), validForEntireCoverage: z.boolean().default(true) })), async (c) => {
  const user = c.get('user'), input = c.req.valid('json');
  const levelId = c.req.param('levelId'), requirementId = c.req.param('requirementId');
  const row = await c.env.DB.prepare(`SELECT l.id,g.id group_id FROM levels l JOIN groups g ON g.id=l.group_id JOIN requirements r ON r.id=?
      WHERE l.id=? AND g.organization_id=? AND r.organization_id=?`)
    .bind(requirementId, levelId, user.organizationId, user.organizationId).first<{ id: string; group_id: string }>();
  if (!row) return c.json({ error: 'RESOURCE_SCOPE_MISMATCH' }, 400);
  const previous = await c.env.DB.prepare(`SELECT mandatory,valid_for_entire_coverage FROM target_level_requirements WHERE target_level_id=? AND requirement_id=?`)
    .bind(levelId, requirementId).first();
  await c.env.DB.prepare(`INSERT INTO target_level_requirements(target_level_id,requirement_id,mandatory,valid_for_entire_coverage)
      VALUES(?,?,?,?) ON CONFLICT(target_level_id,requirement_id) DO UPDATE SET mandatory=excluded.mandatory,valid_for_entire_coverage=excluded.valid_for_entire_coverage`)
    .bind(levelId, requirementId, input.mandatory ? 1 : 0, input.validForEntireCoverage ? 1 : 0).run();
  await new AuditWriter(c.env.DB).append({ organizationId: user.organizationId, actorId: user.id, actorRole: user.role, entityType: 'LEVEL_REQUIREMENT', entityId: `${levelId}:${requirementId}`, action: previous ? 'UPDATED' : 'CREATED', previousValue: previous ?? undefined, newValue: { levelId, requirementId, ...input }, correlationId: c.get('correlationId') });
  return c.json({ updated: true });
});

configurationRoutes.post('/rotation-pools', zValidator('json', z.object({ groupId: z.string(), sourceLevelId: z.string(), targetLevelId: z.string(), employeeIds: z.array(z.string()).min(1) })), async (c) => {
  const user = c.get('user'), input = c.req.valid('json');
  await assertGroupAccess(c, input.groupId);
  const employeeIds = [...new Set(input.employeeIds)];
  if (employeeIds.length !== input.employeeIds.length) return c.json({ error: 'ROTATION_EMPLOYEE_DUPLICATE' }, 400);
  const transition = await c.env.DB.prepare(`SELECT 1 ok FROM level_transitions WHERE group_id=? AND source_level_id=? AND target_level_id=? AND active=1`)
    .bind(input.groupId, input.sourceLevelId, input.targetLevelId).first();
  if (!transition) return c.json({ error: 'LEVEL_TRANSITION_NOT_ALLOWED' }, 400);
  const employees = await c.env.DB.prepare(`SELECT id FROM employees WHERE organization_id=? AND group_id=? AND base_level_id=? AND id IN (${employeeIds.map(() => '?').join(',')})`)
    .bind(user.organizationId, input.groupId, input.sourceLevelId, ...employeeIds).all();
  if ((employees.results ?? []).length !== employeeIds.length) return c.json({ error: 'ROTATION_EMPLOYEE_SCOPE_MISMATCH' }, 400);
  const poolId = crypto.randomUUID();
  const statements = [
    c.env.DB.prepare(`INSERT INTO rotation_pools(id,organization_id,group_id,source_level_id,target_level_id) VALUES(?,?,?,?,?)`)
      .bind(poolId, user.organizationId, input.groupId, input.sourceLevelId, input.targetLevelId),
    ...employeeIds.map((id, index) => c.env.DB.prepare(`INSERT INTO rotation_queue_entries(id,pool_id,employee_id,queue_position,status) VALUES(?,?,?,?,'AVAILABLE')`)
      .bind(crypto.randomUUID(), poolId, id, index + 1)),
  ];
  await c.env.DB.batch(statements);
  await new AuditWriter(c.env.DB).append({ organizationId: user.organizationId, actorId: user.id, actorRole: user.role, entityType: 'ROTATION_POOL', entityId: poolId, action: 'CREATED', newValue: { groupId: input.groupId, sourceLevelId: input.sourceLevelId, targetLevelId: input.targetLevelId, employeeIds }, ruleApplied: 'AUTHORIZED_LEVEL_TRANSITION', correlationId: c.get('correlationId') });
  return c.json({ id: poolId, queue: employeeIds.map((employeeId, index) => ({ employeeId, position: index + 1 })) }, 201);
});

configurationRoutes.post('/users', zValidator('json', z.object({ email: z.string().email(), displayName: z.string().min(2), role: z.enum(['ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'OPERATOR', 'EMPLOYEE', 'AUDITOR']), employeeId: z.string().nullable().optional(), groupIds: z.array(z.string()).default([]) })), async (c) => {
  const user = c.get('user'), input = c.req.valid('json');
  if (!canProvisionRole(user.role, input.role)) return c.json({ error: 'ROLE_PROVISIONING_FORBIDDEN' }, 403);
  const groupIds = [...new Set(input.groupIds)];
  for (const groupId of groupIds) await assertGroupAccess(c, groupId);
  let employeeGroupId: string | null = null;
  if (input.employeeId) {
    const employee = await c.env.DB.prepare(`SELECT group_id FROM employees WHERE id=? AND organization_id=? AND active=1`)
      .bind(input.employeeId, user.organizationId).first<{ group_id: string }>();
    if (!employee) return c.json({ error: 'USER_EMPLOYEE_SCOPE_MISMATCH' }, 400);
    employeeGroupId = employee.group_id;
  }
  if (input.role === 'EMPLOYEE' && !input.employeeId) return c.json({ error: 'EMPLOYEE_ROLE_REQUIRES_EMPLOYEE_ID' }, 400);
  if (input.role === 'EMPLOYEE' && employeeGroupId && !groupIds.includes(employeeGroupId)) groupIds.push(employeeGroupId);
  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO users(id,organization_id,email,display_name,role,employee_id) VALUES(?,?,?,?,?,?)`)
      .bind(id, user.organizationId, input.email, input.displayName, input.role, input.employeeId ?? null),
    ...groupIds.map((groupId) => c.env.DB.prepare(`INSERT INTO user_groups(user_id,group_id) VALUES(?,?)`).bind(id, groupId)),
  ]);
  await new AuditWriter(c.env.DB).append({ organizationId: user.organizationId, actorId: user.id, actorRole: user.role, entityType: 'USER', entityId: id, action: 'CREATED', newValue: { email: input.email, displayName: input.displayName, role: input.role, employeeId: input.employeeId ?? null, groupIds }, ruleApplied: 'ROLE_PROVISIONING_POLICY', correlationId: c.get('correlationId') });
  return c.json({ id, ...input, groupIds }, 201);
});
