import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { authenticate, requireRoles } from '../auth.js';
import type { AppBindings } from '../types.js';

export const workflowRoutes = new Hono<AppBindings>();
workflowRoutes.use('*', authenticate);

workflowRoutes.post(
  '/workflows/coverage',
  requireRoles('ADMIN', 'HR'),
  zValidator(
    'json',
    z.object({
      coverageCaseId: z.string().min(1),
      processType: z.enum(['ROTATION', 'COMPETITION']),
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
    }),
  ),
  async (context) => {
    const payload = context.req.valid('json');
    const instance = await context.env.COVERAGE_WORKFLOW.create({
      id: `coverage-${payload.coverageCaseId}`,
      params: payload,
    });
    return context.json({ workflowInstanceId: instance.id }, 202);
  },
);

workflowRoutes.post(
  '/workflows/:id/approve',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE'),
  async (context) => {
    const instance = await context.env.COVERAGE_WORKFLOW.get(context.req.param('id'));
    await instance.sendEvent({
      type: 'assignment-approved',
      payload: { approvedBy: context.get('user').id, approvedAt: new Date().toISOString() },
    });
    return context.json({ accepted: true });
  },
);
