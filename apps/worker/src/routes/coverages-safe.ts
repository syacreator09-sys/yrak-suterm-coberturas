import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { authenticate, requireRoles } from '../auth.js';
import { requireIdempotency } from '../idempotency.js';
import { enqueueOutbox } from '../outbox.js';
import { createSafeCoverage } from '../services/coverage-creation-safe.js';
import type { AppBindings } from '../types.js';

export const safeCoverageRoutes = new Hono<AppBindings>();
safeCoverageRoutes.use('*', authenticate);

safeCoverageRoutes.post(
  '/coverages',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'OPERATOR'),
  requireIdempotency('CREATE_SAFE_COVERAGE'),
  zValidator(
    'json',
    z.object({
      absentEmployeeId: z.string(),
      reason: z.string().min(2),
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
      source: z
        .enum(['MANUAL', 'EMAIL', 'AUDIO', 'IMAGE', 'DOCUMENT', 'INTEGRATION'])
        .default('MANUAL'),
      competition: z
        .object({
          registrationStartsAt: z.iso.datetime(),
          registrationEndsAt: z.iso.datetime(),
          examAt: z.iso.datetime(),
          minimumScore: z.number().min(0).max(100).optional(),
          tieBreakers: z
            .array(
              z.object({
                type: z.enum(['CRITICAL_SECTION', 'SENIORITY', 'EMPLOYEE_ID']),
              }),
            )
            .optional(),
        })
        .optional(),
    }),
  ),
  async (context) => {
    const result = await createSafeCoverage(
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
