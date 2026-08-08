import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppBindings } from '../env.js';
import { requireRoles } from '../middleware.js';
import { AuditWriter } from '@yrak/audit';

export const importRoutes = new Hono<AppBindings>();

const employeeSchema = z.object({
  id: z.string().optional(),
  employeeNumber: z.string().min(1).max(120),
  name: z.string().min(2).max(240),
  email: z.string().email().nullable().optional(),
  groupId: z.string(),
  baseLevelId: z.string(),
  seniorityDate: z.string().nullable().optional(),
});

async function auditImport(
  c: Context<AppBindings>,
  kind: string,
  count: number,
  metadata: Record<string, unknown> = {},
) {
  const user = c.get('user');
  await new AuditWriter(c.env.DB).append({
    organizationId: user.organizationId,
    actorId: user.id,
    actorRole: user.role,
    entityType: 'IMPORT',
    entityId: c.get('correlationId'),
    action: `IMPORTED_${kind}`,
    newValue: { count, ...metadata },
    correlationId: c.get('correlationId'),
  });
}

async function groupOwned(c: Context<AppBindings>, groupId: string): Promise<boolean> {
  const user = c.get('user');
  return Boolean(await c.env.DB.prepare(`SELECT id FROM groups WHERE id=? AND organization_id=?`)
    .bind(groupId, user.organizationId).first());
}

async function validateUniqueGroupIds(c: Context<AppBindings>, groupIds: readonly string[]): Promise<string[] | null> {
  const unique = [...new Set(groupIds)];
  for (const groupId of unique) if (!await groupOwned(c, groupId)) return null;
  return unique;
}

importRoutes.post('/catalog', requireRoles('ADMIN', 'HR'), zValidator('json', z.object({
  groups: z.array(z.object({
    id: z.string(),
    name: z.string().min(1).max(240),
    description: z.string().nullable().optional(),
    levels: z.array(z.object({ id: z.string(), number: z.number().int(), name: z.string().min(1).max(240), rankOrder: z.number().int() })),
    transitions: z.array(z.object({ id: z.string().optional(), sourceLevelId: z.string(), targetLevelId: z.string() })).default([]),
  })).min(1).max(200),
})), async (c) => {
  const user = c.get('user'), groups = c.req.valid('json').groups;
  const statements: D1PreparedStatement[] = [];
  let levelCount = 0, transitionCount = 0;

  for (const group of groups) {
    const existingGroup = await c.env.DB.prepare(`SELECT organization_id FROM groups WHERE id=?`).bind(group.id)
      .first<{ organization_id: string }>();
    if (existingGroup && existingGroup.organization_id !== user.organizationId) {
      return c.json({ error: 'IMPORT_GROUP_ID_SCOPE_CONFLICT' }, 400);
    }

    const existingLevels = await c.env.DB.prepare(`SELECT l.id FROM levels l JOIN groups g ON g.id=l.group_id WHERE l.group_id=? AND g.organization_id=?`)
      .bind(group.id, user.organizationId).all<{ id: string }>();
    const allowedLevelIds = new Set((existingLevels.results ?? []).map((row) => row.id));

    for (const level of group.levels) {
      const existingLevel = await c.env.DB.prepare(`SELECT l.group_id,g.organization_id FROM levels l JOIN groups g ON g.id=l.group_id WHERE l.id=?`)
        .bind(level.id).first<{ group_id: string; organization_id: string }>();
      if (existingLevel && (existingLevel.organization_id !== user.organizationId || existingLevel.group_id !== group.id)) {
        return c.json({ error: 'IMPORT_LEVEL_ID_SCOPE_CONFLICT' }, 400);
      }
      allowedLevelIds.add(level.id);
    }
    for (const transition of group.transitions) {
      if (!allowedLevelIds.has(transition.sourceLevelId) || !allowedLevelIds.has(transition.targetLevelId)) {
        return c.json({ error: 'IMPORT_TRANSITION_LEVEL_SCOPE_MISMATCH' }, 400);
      }
      if (transition.sourceLevelId === transition.targetLevelId) return c.json({ error: 'IMPORT_TRANSITION_SELF_REFERENCE' }, 400);
    }

    statements.push(c.env.DB.prepare(`INSERT INTO groups(id,organization_id,name,description) VALUES(?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description
      WHERE groups.organization_id=excluded.organization_id`)
      .bind(group.id, user.organizationId, group.name, group.description ?? null));
    for (const level of group.levels) {
      levelCount += 1;
      statements.push(c.env.DB.prepare(`INSERT INTO levels(id,group_id,level_number,name,rank_order) VALUES(?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET level_number=excluded.level_number,name=excluded.name,rank_order=excluded.rank_order
        WHERE levels.group_id=excluded.group_id`)
        .bind(level.id, group.id, level.number, level.name, level.rankOrder));
    }
    for (const transition of group.transitions) {
      transitionCount += 1;
      statements.push(c.env.DB.prepare(`INSERT INTO level_transitions(id,group_id,source_level_id,target_level_id) VALUES(?,?,?,?)
        ON CONFLICT(group_id,source_level_id,target_level_id) DO UPDATE SET active=1`)
        .bind(transition.id ?? crypto.randomUUID(), group.id, transition.sourceLevelId, transition.targetLevelId));
    }
  }

  await c.env.DB.batch(statements);
  await auditImport(c, 'CATALOG', groups.length, { levelCount, transitionCount, groupIds: groups.map((group) => group.id) });
  return c.json({ groups: groups.length, statements: statements.length });
});

importRoutes.post('/employees', requireRoles('ADMIN', 'HR'), zValidator('json', z.object({ items: z.array(employeeSchema).min(1).max(1000) })), async (c) => {
  const user = c.get('user'), items = c.req.valid('json').items;
  const errors: Array<{ row: number; code: string }> = [], statements: D1PreparedStatement[] = [];
  for (const [index, item] of items.entries()) {
    if (item.id) {
      const byId = await c.env.DB.prepare(`SELECT organization_id FROM employees WHERE id=?`).bind(item.id).first<{ organization_id: string }>();
      if (byId && byId.organization_id !== user.organizationId) {
        errors.push({ row: index + 1, code: 'EMPLOYEE_ID_SCOPE_CONFLICT' });
        continue;
      }
    }
    const scope = await c.env.DB.prepare(`SELECT l.id FROM levels l JOIN groups g ON g.id=l.group_id
      WHERE l.id=? AND g.id=? AND g.organization_id=?`).bind(item.baseLevelId, item.groupId, user.organizationId).first();
    if (!scope) {
      errors.push({ row: index + 1, code: 'GROUP_LEVEL_SCOPE_MISMATCH' });
      continue;
    }
    statements.push(c.env.DB.prepare(`INSERT INTO employees(id,organization_id,group_id,base_level_id,employee_number,name,email,seniority_date)
      VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(organization_id,employee_number) DO UPDATE SET
        group_id=excluded.group_id,base_level_id=excluded.base_level_id,name=excluded.name,email=excluded.email,
        seniority_date=excluded.seniority_date,active=1,version=employees.version+1,updated_at=datetime('now')`)
      .bind(item.id ?? crypto.randomUUID(), user.organizationId, item.groupId, item.baseLevelId, item.employeeNumber, item.name, item.email ?? null, item.seniorityDate ?? null));
  }
  if (errors.length) return c.json({ imported: 0, errors }, 400);
  await c.env.DB.batch(statements);
  await auditImport(c, 'EMPLOYEES', items.length, { groupIds: [...new Set(items.map((item) => item.groupId))] });
  return c.json({ imported: items.length, errors: [] });
});

importRoutes.post('/requirements', requireRoles('ADMIN', 'HR'), zValidator('json', z.object({
  items: z.array(z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(240),
    requirementType: z.enum(['COURSE', 'CERTIFICATION', 'PREREQUISITE_EXAM', 'DOCUMENT', 'EXPERIENCE', 'OTHER']),
    validityDays: z.number().int().positive().nullable().optional(),
  })).min(1).max(1000),
})), async (c) => {
  const user = c.get('user'), items = c.req.valid('json').items;
  for (const item of items) {
    if (!item.id) continue;
    const existing = await c.env.DB.prepare(`SELECT organization_id FROM requirements WHERE id=?`).bind(item.id).first<{ organization_id: string }>();
    if (existing && existing.organization_id !== user.organizationId) return c.json({ error: 'REQUIREMENT_ID_SCOPE_CONFLICT' }, 400);
  }
  await c.env.DB.batch(items.map((item) => c.env.DB.prepare(`INSERT INTO requirements(id,organization_id,name,requirement_type,validity_days) VALUES(?,?,?,?,?)`)
    .bind(item.id ?? crypto.randomUUID(), user.organizationId, item.name, item.requirementType, item.validityDays ?? null)));
  await auditImport(c, 'REQUIREMENTS', items.length);
  return c.json({ imported: items.length });
});

importRoutes.post('/employee-requirements', requireRoles('ADMIN', 'HR'), zValidator('json', z.object({
  items: z.array(z.object({
    employeeId: z.string(),
    requirementId: z.string(),
    status: z.enum(['COMPLIANT', 'MISSING', 'EXPIRED', 'PENDING', 'REJECTED', 'NOT_APPLICABLE']),
    completedAt: z.string().nullable().optional(),
    validUntil: z.string().nullable().optional(),
    score: z.number().min(0).max(100).nullable().optional(),
  })).min(1).max(2000),
})), async (c) => {
  const user = c.get('user'), items = c.req.valid('json').items;
  for (const item of items) {
    const scope = await c.env.DB.prepare(`SELECT e.id FROM employees e JOIN requirements r ON r.id=?
      WHERE e.id=? AND e.organization_id=? AND r.organization_id=?`)
      .bind(item.requirementId, item.employeeId, user.organizationId, user.organizationId).first();
    if (!scope) return c.json({ error: 'EMPLOYEE_REQUIREMENT_SCOPE_MISMATCH', employeeId: item.employeeId, requirementId: item.requirementId }, 400);
  }
  await c.env.DB.batch(items.map((item) => c.env.DB.prepare(`INSERT INTO employee_requirements(id,employee_id,requirement_id,status,completed_at,valid_until,score,verified_by,verified_at)
      VALUES(?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(employee_id,requirement_id) DO UPDATE SET
        status=excluded.status,completed_at=excluded.completed_at,valid_until=excluded.valid_until,score=excluded.score,
        verified_by=excluded.verified_by,verified_at=datetime('now'),version=employee_requirements.version+1,updated_at=datetime('now')`)
    .bind(crypto.randomUUID(), item.employeeId, item.requirementId, item.status, item.completedAt ?? null, item.validUntil ?? null, item.score ?? null, user.id)));
  await auditImport(c, 'EMPLOYEE_REQUIREMENTS', items.length);
  return c.json({ imported: items.length });
});

importRoutes.post('/users', requireRoles('ADMIN'), zValidator('json', z.object({
  items: z.array(z.object({
    id: z.string().optional(),
    email: z.string().email(),
    displayName: z.string().min(2).max(240),
    role: z.enum(['ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'OPERATOR', 'EMPLOYEE', 'AUDITOR']),
    employeeId: z.string().nullable().optional(),
    groupIds: z.array(z.string()).default([]),
  })).min(1).max(500),
})), async (c) => {
  const user = c.get('user'), items = c.req.valid('json').items;
  const normalized: Array<(typeof items)[number] & { groupIds: string[] }> = [];

  for (const item of items) {
    if (item.id) {
      const byId = await c.env.DB.prepare(`SELECT organization_id FROM users WHERE id=?`).bind(item.id).first<{ organization_id: string }>();
      if (byId && byId.organization_id !== user.organizationId) return c.json({ error: 'USER_ID_SCOPE_CONFLICT' }, 400);
    }
    const groupIds = [...new Set(item.groupIds)];
    if (!await validateUniqueGroupIds(c, groupIds)) return c.json({ error: 'USER_GROUP_SCOPE_MISMATCH' }, 400);

    let employeeGroupId: string | null = null;
    if (item.employeeId) {
      const employee = await c.env.DB.prepare(`SELECT group_id FROM employees WHERE id=? AND organization_id=? AND active=1`)
        .bind(item.employeeId, user.organizationId).first<{ group_id: string }>();
      if (!employee) return c.json({ error: 'USER_EMPLOYEE_SCOPE_MISMATCH' }, 400);
      employeeGroupId = employee.group_id;
    }
    if (item.role === 'EMPLOYEE' && !item.employeeId) return c.json({ error: 'EMPLOYEE_ROLE_REQUIRES_EMPLOYEE_ID' }, 400);
    if (item.role === 'EMPLOYEE' && employeeGroupId && !groupIds.includes(employeeGroupId)) groupIds.push(employeeGroupId);
    normalized.push({ ...item, groupIds });
  }

  for (const item of normalized) {
    const userId = item.id ?? crypto.randomUUID();
    await c.env.DB.prepare(`INSERT INTO users(id,organization_id,email,display_name,role,employee_id) VALUES(?,?,?,?,?,?)
      ON CONFLICT(organization_id,email) DO UPDATE SET display_name=excluded.display_name,role=excluded.role,employee_id=excluded.employee_id,active=1`)
      .bind(userId, user.organizationId, item.email, item.displayName, item.role, item.employeeId ?? null).run();
    const resolved = await c.env.DB.prepare(`SELECT id FROM users WHERE organization_id=? AND lower(email)=lower(?)`)
      .bind(user.organizationId, item.email).first<{ id: string }>();
    if (!resolved) throw new Error('IMPORTED_USER_NOT_RESOLVED');
    await c.env.DB.prepare(`DELETE FROM user_groups WHERE user_id=?`).bind(resolved.id).run();
    if (item.groupIds.length) await c.env.DB.batch(item.groupIds.map((groupId) => c.env.DB.prepare(`INSERT INTO user_groups(user_id,group_id) VALUES(?,?)`).bind(resolved.id, groupId)));
  }
  await auditImport(c, 'USERS', normalized.length, { roles: [...new Set(normalized.map((item) => item.role))] });
  return c.json({ imported: normalized.length });
});

importRoutes.post('/holidays', requireRoles('ADMIN', 'HR'), zValidator('json', z.object({
  items: z.array(z.object({ groupId: z.string().nullable().optional(), date: z.string(), name: z.string().min(1).max(240) })).min(1).max(1000),
})), async (c) => {
  const user = c.get('user'), items = c.req.valid('json').items;
  const groupIds = [...new Set(items.flatMap((item) => item.groupId ? [item.groupId] : []))];
  if (!await validateUniqueGroupIds(c, groupIds)) return c.json({ error: 'HOLIDAY_GROUP_SCOPE_MISMATCH' }, 400);
  await c.env.DB.batch(items.map((item) => c.env.DB.prepare(`INSERT INTO holidays(id,organization_id,group_id,holiday_date,name) VALUES(?,?,?,?,?)
    ON CONFLICT(organization_id,group_id,holiday_date) DO UPDATE SET name=excluded.name`)
    .bind(crypto.randomUUID(), user.organizationId, item.groupId ?? null, item.date, item.name)));
  await auditImport(c, 'HOLIDAYS', items.length, { groupIds });
  return c.json({ imported: items.length });
});

importRoutes.post('/group-shifts', requireRoles('ADMIN', 'HR'), zValidator('json', z.object({
  items: z.array(z.object({ groupId: z.string(), date: z.string(), shiftCode: z.string().nullable().optional(), scheduled: z.boolean().default(true) })).min(1).max(5000),
})), async (c) => {
  const user = c.get('user'), items = c.req.valid('json').items;
  const groupIds = [...new Set(items.map((item) => item.groupId))];
  if (!await validateUniqueGroupIds(c, groupIds)) return c.json({ error: 'GROUP_SCOPE_MISMATCH' }, 400);
  await c.env.DB.batch(items.map((item) => c.env.DB.prepare(`INSERT INTO group_shift_dates(id,group_id,shift_date,scheduled,shift_code) VALUES(?,?,?,?,?)
    ON CONFLICT(group_id,shift_date) DO UPDATE SET scheduled=excluded.scheduled,shift_code=excluded.shift_code`)
    .bind(crypto.randomUUID(), item.groupId, item.date, item.scheduled ? 1 : 0, item.shiftCode ?? null)));
  await auditImport(c, 'GROUP_SHIFTS', items.length, { groupIds });
  return c.json({ imported: items.length });
});
