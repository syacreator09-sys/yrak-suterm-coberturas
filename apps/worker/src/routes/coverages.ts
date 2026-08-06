import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { authenticate, requireRoles } from '../auth.js';
import { enqueueOutbox } from '../outbox.js';
import { createCoverage } from '../services/coverage-service.js';
import { decideApproval } from '../services/approval-service.js';
import type { AppBindings } from '../types.js';

export const coverageRoutes = new Hono<AppBindings>();
coverageRoutes.use('*', authenticate);

coverageRoutes.get('/coverages', requireRoles('ADMIN','HR','SUPERVISOR','COMMITTEE','AUDITOR','OPERATOR'), async (context) => {
  const result = await context.env.DB.prepare(`SELECT cc.*, a.reason, e.name AS absent_employee_name
    FROM coverage_cases cc JOIN absences a ON a.id = cc.absence_id
    JOIN employees e ON e.id = a.employee_id JOIN groups g ON g.id = cc.group_id
    WHERE g.organization_id = ? ORDER BY cc.created_at DESC LIMIT 200`)
    .bind(context.get('user').organizationId)
    .all();
  return context.json({ items: result.results ?? [] });
});

coverageRoutes.get('/coverages/:id', requireRoles('ADMIN','HR','SUPERVISOR','COMMITTEE','AUDITOR','OPERATOR','EMPLOYEE'), async (context) => {
  const user = context.get('user');
  const item = await context.env.DB.prepare(`SELECT cc.*, a.employee_id AS absent_employee_id,
      a.reason, e.name AS absent_employee_name
    FROM coverage_cases cc JOIN absences a ON a.id = cc.absence_id
    JOIN employees e ON e.id = a.employee_id JOIN groups g ON g.id = cc.group_id
    WHERE cc.id = ? AND g.organization_id = ?`)
    .bind(context.req.param('id'), user.organizationId)
    .first<{ absent_employee_id: string } & Record<string, unknown>>();
  if (!item) return context.json({ error: 'NOT_FOUND' }, 404);
  if (user.roles.includes('EMPLOYEE') && !user.roles.some((role) => ['ADMIN','HR','SUPERVISOR','COMMITTEE','AUDITOR','OPERATOR'].includes(role))) {
    const related = await context.env.DB.prepare(`SELECT 1 AS related
      FROM temporary_assignments WHERE coverage_case_id = ? AND employee_id = ? LIMIT 1`)
      .bind(context.req.param('id'), user.employeeId)
      .first();
    if (item.absent_employee_id !== user.employeeId && !related) return context.json({ error: 'FORBIDDEN' }, 403);
  }
  const assignments = await context.env.DB.prepare('SELECT * FROM temporary_assignments WHERE coverage_case_id = ? ORDER BY chain_order').bind(context.req.param('id')).all();
  const approvals = await context.env.DB.prepare("SELECT * FROM approvals WHERE entity_type = 'COVERAGE_CASE' AND entity_id = ? ORDER BY requested_at").bind(context.req.param('id')).all();
  return context.json({ item, assignments: assignments.results ?? [], approvals: approvals.results ?? [] });
});

coverageRoutes.post(
  '/coverages',
  requireRoles('ADMIN','HR','SUPERVISOR','OPERATOR'),
  zValidator('json', z.object({
    absentEmployeeId: z.string(),
    reason: z.string().min(2),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    source: z.enum(['MANUAL','EMAIL','AUDIO','IMAGE','DOCUMENT','INTEGRATION']).default('MANUAL'),
    competition: z.object({
      registrationStartsAt: z.iso.datetime(),
      registrationEndsAt: z.iso.datetime(),
      examAt: z.iso.datetime(),
      minimumScore: z.number().min(0).max(100).optional(),
      tieBreakers: z.array(z.object({ type: z.enum(['CRITICAL_SECTION','SENIORITY','EMPLOYEE_ID']) })).optional(),
    }).optional(),
  })),
  async (context) => {
    const result = await createCoverage(
      context.env,
      context.get('user'),
      context.get('correlationId'),
      context.req.valid('json'),
    );
    const competition = result.competition;
    if (competition && typeof competition === 'object' && 'competitionId' in competition) {
      await enqueueOutbox(
        context.env,
        'COMPETITION_OPENED',
        'COMPETITION',
        String((competition as { competitionId: unknown }).competitionId),
      );
    }
    return context.json(result, 201);
  },
);

coverageRoutes.post(
  '/approvals/:id/decide',
  requireRoles('ADMIN','HR','SUPERVISOR','COMMITTEE'),
  zValidator('json', z.object({ decision: z.enum(['APPROVED','REJECTED']), reason: z.string().min(2) })),
  async (context) => {
    const input = context.req.valid('json');
    const result = await decideApproval(
      context.env,
      context.get('user'),
      context.get('correlationId'),
      context.req.param('id'),
      input.decision,
      input.reason,
    );
    return context.json(result);
  },
);
