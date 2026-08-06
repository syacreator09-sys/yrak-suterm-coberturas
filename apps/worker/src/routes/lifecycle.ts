import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { authenticate, requireRoles } from '../auth.js';
import { requireIdempotency } from '../idempotency.js';
import { completeCoverage } from '../services/completion-service.js';
import type { AppBindings } from '../types.js';

export const lifecycleRoutes = new Hono<AppBindings>();
lifecycleRoutes.use('*', authenticate);

lifecycleRoutes.post(
  '/coverages/:id/complete-early',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR'),
  requireIdempotency('COMPLETE_COVERAGE_EARLY'),
  zValidator(
    'json',
    z.object({
      returnedAt: z.iso.datetime().default(() => new Date().toISOString()),
      reason: z.string().min(3),
    }),
  ),
  async (context) => {
    const user = context.get('user');
    const result = await completeCoverage(context.env, {
      coverageCaseId: context.req.param('id'),
      returnedAt: context.req.valid('json').returnedAt,
      reason: context.req.valid('json').reason,
      correlationId: context.get('correlationId'),
      actor: { id: user.id, type: 'USER' },
      organizationId: user.organizationId,
    });
    return context.json(result);
  },
);
