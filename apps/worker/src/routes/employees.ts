import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { authenticate, requireRoles } from '../auth.js';
import { appendAudit } from '../audit.js';
import type { AppBindings } from '../types.js';

export const employeeRoutes = new Hono<AppBindings>();
employeeRoutes.use('*', authenticate);

employeeRoutes.get('/employees', requireRoles('ADMIN','HR','SUPERVISOR','COMMITTEE','AUDITOR'), async (context) => {
  const result = await context.env.DB.prepare(`SELECT e.id, e.employee_number, e.name, e.email,
      e.group_id, e.base_level_id, e.seniority_date, e.active
    FROM employees e WHERE e.organization_id = ? ORDER BY e.name`)
    .bind(context.get('user').organizationId)
    .all();
  return context.json({ items: result.results ?? [] });
});

employeeRoutes.post(
  '/employees',
  requireRoles('ADMIN','HR'),
  zValidator('json', z.object({
    employeeNumber: z.string().min(1),
    name: z.string().min(2),
    email: z.email().nullable().optional(),
    groupId: z.string(),
    baseLevelId: z.string(),
    seniorityDate: z.string(),
  })),
  async (context) => {
    const input = context.req.valid('json');
    const user = context.get('user');
    const id = crypto.randomUUID();
    await context.env.DB.prepare(`INSERT INTO employees (
      id, organization_id, group_id, base_level_id, employee_number, name, email,
      seniority_date, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`)
      .bind(id, user.organizationId, input.groupId, input.baseLevelId, input.employeeNumber, input.name, input.email ?? null, input.seniorityDate)
      .run();
    await appendAudit(context.env, {
      organizationId: user.organizationId,
      actor: user,
      entityType: 'EMPLOYEE',
      entityId: id,
      action: 'CREATED',
      newValue: input,
      correlationId: context.get('correlationId'),
    });
    return context.json({ id, ...input }, 201);
  },
);

employeeRoutes.put(
  '/employees/:employeeId/requirements/:requirementId',
  requireRoles('ADMIN','HR'),
  zValidator('json', z.object({
    status: z.enum(['COMPLIANT','MISSING','EXPIRED','PENDING','REJECTED','NOT_APPLICABLE']),
    completedAt: z.string().nullable().optional(),
    validUntil: z.string().nullable().optional(),
    score: z.number().min(0).max(100).nullable().optional(),
    evidenceAttachmentId: z.string().nullable().optional(),
  })),
  async (context) => {
    const input = context.req.valid('json');
    const user = context.get('user');
    const id = crypto.randomUUID();
    await context.env.DB.prepare(`INSERT INTO employee_requirements (
      id, employee_id, requirement_id, status, completed_at, valid_until, score,
      evidence_attachment_id, verified_by, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(employee_id, requirement_id) DO UPDATE SET
      status = excluded.status,
      completed_at = excluded.completed_at,
      valid_until = excluded.valid_until,
      score = excluded.score,
      evidence_attachment_id = excluded.evidence_attachment_id,
      verified_by = excluded.verified_by,
      verified_at = datetime('now'),
      version = employee_requirements.version + 1,
      updated_at = datetime('now')`)
      .bind(id, context.req.param('employeeId'), context.req.param('requirementId'), input.status, input.completedAt ?? null, input.validUntil ?? null, input.score ?? null, input.evidenceAttachmentId ?? null, user.id)
      .run();
    await appendAudit(context.env, {
      organizationId: user.organizationId,
      actor: user,
      entityType: 'EMPLOYEE_REQUIREMENT',
      entityId: `${context.req.param('employeeId')}:${context.req.param('requirementId')}`,
      action: 'UPSERTED',
      newValue: input,
      correlationId: context.get('correlationId'),
    });
    return context.json({ updated: true });
  },
);
