import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { authenticate, requireRoles } from '../auth.js';
import { enqueueOutbox } from '../outbox.js';
import {
  approveScoreRevision,
  finalizeCompetition,
  recordScore,
} from '../services/competition-service.js';
import type { AppBindings } from '../types.js';

export const competitionRoutes = new Hono<AppBindings>();
competitionRoutes.use('*', authenticate);

competitionRoutes.get('/competitions/:id', requireRoles('ADMIN','HR','COMMITTEE','AUDITOR'), async (context) => {
  const competition = await context.env.DB.prepare('SELECT * FROM competitions WHERE id = ?').bind(context.req.param('id')).first();
  if (!competition) return context.json({ error: 'NOT_FOUND' }, 404);
  const candidates = await context.env.DB.prepare(`SELECT cc.*, e.name, e.employee_number
    FROM competition_candidates cc JOIN employees e ON e.id = cc.employee_id
    WHERE cc.competition_id = ? ORDER BY e.name`).bind(context.req.param('id')).all();
  return context.json({ competition, candidates: candidates.results ?? [] });
});

competitionRoutes.post(
  '/competitions/:id/accept',
  requireRoles('ADMIN','HR','EMPLOYEE'),
  zValidator('json', z.object({ employeeId: z.string(), accepted: z.boolean() })),
  async (context) => {
    const input = context.req.valid('json');
    const user = context.get('user');
    if (user.roles.includes('EMPLOYEE') && !user.roles.some((role) => ['ADMIN','HR'].includes(role)) && user.employeeId !== input.employeeId) {
      return context.json({ error: 'FORBIDDEN' }, 403);
    }
    await context.env.DB.prepare(`UPDATE competition_candidates
      SET accepted_participation = ?, accepted_at = datetime('now'),
          result_status = CASE WHEN ? = 1 THEN 'PENDING' ELSE 'WITHDRAWN' END
      WHERE competition_id = ? AND employee_id = ? AND eligibility_status = 'ELIGIBLE'`)
      .bind(input.accepted ? 1 : 0, input.accepted ? 1 : 0, context.req.param('id'), input.employeeId)
      .run();
    return context.json({ accepted: input.accepted });
  },
);

competitionRoutes.post(
  '/competitions/:id/scores',
  requireRoles('ADMIN','HR','COMMITTEE'),
  zValidator('json', z.object({
    employeeId: z.string(),
    examScore: z.number().min(0).max(100),
    criticalSectionScore: z.number().min(0).max(100).optional(),
    correctionReason: z.string().optional(),
  })),
  async (context) => {
    const result = await recordScore(context.env, context.get('user'), context.get('correlationId'), {
      competitionId: context.req.param('id'),
      ...context.req.valid('json'),
    });
    return context.json(result, 201);
  },
);

competitionRoutes.post(
  '/score-revisions/:id/approve',
  requireRoles('ADMIN','HR','COMMITTEE'),
  async (context) => {
    await approveScoreRevision(context.env, context.get('user'), context.get('correlationId'), context.req.param('id'));
    return context.json({ approved: true });
  },
);

competitionRoutes.post(
  '/competitions/:id/finalize',
  requireRoles('ADMIN','HR','COMMITTEE'),
  async (context) => {
    const result = await finalizeCompetition(context.env, context.get('user'), context.get('correlationId'), context.req.param('id'));
    await enqueueOutbox(
      context.env,
      'COMPETITION_RESULT_PROVISIONAL',
      'COMPETITION',
      context.req.param('id'),
    );
    return context.json(result);
  },
);
