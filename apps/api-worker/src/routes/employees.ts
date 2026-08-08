import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppBindings } from '../env.js';
import { requireRoles, assertGroupAccess } from '../middleware.js';
import { AuditWriter } from '@yrak/audit';

export const employeeRoutes = new Hono<AppBindings>();

employeeRoutes.get('/', requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'AUDITOR'), async (c) => {
  const user = c.get('user');
  const unrestricted = user.role === 'ADMIN' || user.role === 'HR' || user.role === 'AUDITOR';
  const rows = unrestricted
    ? await c.env.DB.prepare(`SELECT id,employee_number,name,email,group_id,base_level_id,seniority_date,active
        FROM employees WHERE organization_id=? ORDER BY name`)
        .bind(user.organizationId).all()
    : await c.env.DB.prepare(`SELECT e.id,e.employee_number,e.name,NULL AS email,e.group_id,e.base_level_id,e.seniority_date,e.active
        FROM employees e JOIN user_groups ug ON ug.group_id=e.group_id AND ug.user_id=?
        WHERE e.organization_id=? ORDER BY e.name`)
        .bind(user.id, user.organizationId).all();
  return c.json({ items: rows.results ?? [] });
});

employeeRoutes.post('/', requireRoles('ADMIN', 'HR'), zValidator('json', z.object({
  employeeNumber: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email().nullable().optional(),
  groupId: z.string(),
  baseLevelId: z.string(),
  seniorityDate: z.string().nullable().optional(),
})), async (c) => {
  const user = c.get('user'), input = c.req.valid('json');
  await assertGroupAccess(c, input.groupId);
  const level = await c.env.DB.prepare('SELECT id FROM levels WHERE id=? AND group_id=?').bind(input.baseLevelId, input.groupId).first();
  if (!level) return c.json({ error: 'BASE_LEVEL_GROUP_MISMATCH' }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO employees(id,organization_id,group_id,base_level_id,employee_number,name,email,seniority_date) VALUES(?,?,?,?,?,?,?,?)`)
    .bind(id, user.organizationId, input.groupId, input.baseLevelId, input.employeeNumber, input.name, input.email ?? null, input.seniorityDate ?? null).run();
  await new AuditWriter(c.env.DB).append({
    organizationId: user.organizationId,
    actorId: user.id,
    actorRole: user.role,
    entityType: 'EMPLOYEE',
    entityId: id,
    action: 'CREATED',
    newValue: input,
    correlationId: c.get('correlationId'),
  });
  return c.json({ id, ...input }, 201);
});

employeeRoutes.post('/:employeeId/unavailability', requireRoles('ADMIN', 'HR', 'SUPERVISOR'), zValidator('json', z.object({
  kind: z.enum(['VACATION', 'SICK_LEAVE', 'PERMISSION', 'OTHER_ASSIGNMENT', 'MANUAL_BLOCK', 'OTHER']),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().nullable().optional(),
})), async (c) => {
  const user = c.get('user'), input = c.req.valid('json');
  const employee = await c.env.DB.prepare(`SELECT group_id FROM employees WHERE id=? AND organization_id=?`)
    .bind(c.req.param('employeeId'), user.organizationId).first<{ group_id: string }>();
  if (!employee) return c.json({ error: 'EMPLOYEE_NOT_FOUND' }, 404);
  await assertGroupAccess(c, employee.group_id);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO employee_unavailability(id,employee_id,kind,starts_on,ends_on,reason) VALUES(?,?,?,?,?,?)`)
    .bind(id, c.req.param('employeeId'), input.kind, input.startDate, input.endDate, input.reason ?? null).run();
  return c.json({ id, ...input }, 201);
});

employeeRoutes.put('/:employeeId/requirements/:requirementId', requireRoles('ADMIN', 'HR'), zValidator('json', z.object({
  status: z.enum(['COMPLIANT', 'MISSING', 'EXPIRED', 'PENDING', 'REJECTED', 'NOT_APPLICABLE']),
  completedAt: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
  score: z.number().min(0).max(100).nullable().optional(),
  evidenceAttachmentId: z.string().nullable().optional(),
})), async (c) => {
  const input = c.req.valid('json'), user = c.get('user');
  const employee = await c.env.DB.prepare(`SELECT id FROM employees WHERE id=? AND organization_id=?`)
    .bind(c.req.param('employeeId'), user.organizationId).first();
  const requirement = await c.env.DB.prepare(`SELECT id FROM requirements WHERE id=? AND organization_id=?`)
    .bind(c.req.param('requirementId'), user.organizationId).first();
  if (!employee || !requirement) return c.json({ error: 'RESOURCE_SCOPE_MISMATCH' }, 404);
  await c.env.DB.prepare(`INSERT INTO employee_requirements(id,employee_id,requirement_id,status,completed_at,valid_until,score,evidence_attachment_id,verified_by,verified_at)
      VALUES(?,?,?,?,?,?,?,?,?,datetime('now'))
      ON CONFLICT(employee_id,requirement_id) DO UPDATE SET
        status=excluded.status,completed_at=excluded.completed_at,valid_until=excluded.valid_until,score=excluded.score,
        evidence_attachment_id=excluded.evidence_attachment_id,verified_by=excluded.verified_by,verified_at=datetime('now'),
        version=employee_requirements.version+1,updated_at=datetime('now')`)
    .bind(crypto.randomUUID(), c.req.param('employeeId'), c.req.param('requirementId'), input.status, input.completedAt ?? null, input.validUntil ?? null, input.score ?? null, input.evidenceAttachmentId ?? null, user.id).run();
  return c.json({ updated: true });
});
