import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppBindings } from '../env.js';
import { assertGroupAccess, requireRoles } from '../middleware.js';
import { AuditWriter } from '@yrak/audit';

export const appealRoutes = new Hono<AppBindings>();

appealRoutes.post('/', zValidator('json', z.object({ coverageCaseId: z.string(), reason: z.string().min(5) })), async (c) => {
  const user = c.get('user'), input = c.req.valid('json');
  const coverage = await c.env.DB.prepare(`SELECT id FROM coverage_cases WHERE id=? AND organization_id=?`)
    .bind(input.coverageCaseId, user.organizationId).first();
  if (!coverage) return c.json({ error: 'COVERAGE_NOT_FOUND' }, 404);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO appeals(id,organization_id,coverage_case_id,employee_id,reason,status,created_by)
      VALUES(?,?,?,?,?,'OPEN',?)`)
    .bind(id, user.organizationId, input.coverageCaseId, user.employeeId ?? null, input.reason, user.id).run();
  await new AuditWriter(c.env.DB).append({
    organizationId: user.organizationId,
    actorId: user.id,
    actorRole: user.role,
    entityType: 'APPEAL',
    entityId: id,
    action: 'OPENED',
    newValue: input,
    correlationId: c.get('correlationId'),
  });
  return c.json({ id, status: 'OPEN' }, 201);
});

appealRoutes.put('/:appealId/resolve', requireRoles('ADMIN', 'HR', 'COMMITTEE'), zValidator('json', z.object({
  status: z.enum(['RESOLVED', 'REJECTED']),
  resolution: z.string().min(3),
})), async (c) => {
  const user = c.get('user'), input = c.req.valid('json'), appealId = c.req.param('appealId');
  const appeal = await c.env.DB.prepare(`SELECT a.id,a.coverage_case_id,a.status,a.resolution,c.group_id
      FROM appeals a JOIN coverage_cases c ON c.id=a.coverage_case_id
      WHERE a.id=? AND a.organization_id=? AND c.organization_id=?`)
    .bind(appealId, user.organizationId, user.organizationId)
    .first<{ id: string; coverage_case_id: string; status: string; resolution: string | null; group_id: string }>();
  if (!appeal || !['OPEN', 'UNDER_REVIEW'].includes(appeal.status)) {
    return c.json({ error: 'APPEAL_NOT_FOUND_OR_CLOSED' }, 404);
  }
  await assertGroupAccess(c, appeal.group_id);

  const result = await c.env.DB.prepare(`UPDATE appeals
      SET status=?,resolution=?,decided_by=?,decided_at=datetime('now')
      WHERE id=? AND organization_id=? AND status IN ('OPEN','UNDER_REVIEW')`)
    .bind(input.status, input.resolution, user.id, appealId, user.organizationId).run();
  if ((result.meta.changes ?? 0) !== 1) return c.json({ error: 'APPEAL_NOT_FOUND_OR_CLOSED' }, 409);

  await new AuditWriter(c.env.DB).append({
    organizationId: user.organizationId,
    actorId: user.id,
    actorRole: user.role,
    entityType: 'APPEAL',
    entityId: appealId,
    action: 'RESOLVED',
    previousValue: { status: appeal.status, resolution: appeal.resolution },
    newValue: { status: input.status, resolution: input.resolution, coverageCaseId: appeal.coverage_case_id, groupId: appeal.group_id },
    correlationId: c.get('correlationId'),
  });
  return c.json({ updated: true });
});
