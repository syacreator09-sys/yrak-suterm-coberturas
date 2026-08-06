import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { countCalendarDays, determineCoverageProcess } from '@yrak/domain';
import { selectNextCandidate } from '@yrak/rotation';
import { evaluateEligibility } from '@yrak/eligibility';
import { rankCandidates } from '@yrak/competition';
import { planCoverageChain } from '@yrak/assignments';
import { authenticate, requireRoles } from '../auth.js';
import type { AppBindings } from '../types.js';

export const engineRoutes = new Hono<AppBindings>();
engineRoutes.use('*', authenticate);

engineRoutes.post(
  '/coverage/preview',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'OPERATOR'),
  zValidator(
    'json',
    z.object({
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
      vacantLevelId: z.string().min(1),
    }),
  ),
  (context) => {
    const input = context.req.valid('json');
    const durationDays = countCalendarDays(input.startsAt, input.endsAt);
    return context.json({
      durationDays,
      processType: determineCoverageProcess(durationDays),
      vacantLevelId: input.vacantLevelId,
      ruleVersion: 'YR-1.0.0',
    });
  },
);

engineRoutes.post(
  '/rotation/select',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'OPERATOR'),
  zValidator(
    'json',
    z.object({
      candidates: z.array(
        z.object({
          employeeId: z.string().min(1),
          position: z.number().int().positive(),
          availability: z.enum(['AVAILABLE', 'UNAVAILABLE', 'RESERVED', 'ASSIGNED', 'SUSPENDED']),
          unavailableReason: z.string().optional(),
        }),
      ),
    }),
  ),
  (context) => context.json(selectNextCandidate(context.req.valid('json').candidates as never)),
);

engineRoutes.post(
  '/eligibility/evaluate',
  requireRoles('ADMIN', 'HR', 'COMMITTEE', 'AUDITOR'),
  zValidator(
    'json',
    z.object({
      employeeId: z.string(),
      requiredRequirementIds: z.array(z.string()),
      evaluations: z.array(
        z.object({
          requirementId: z.string(),
          status: z.enum(['COMPLIANT', 'MISSING', 'EXPIRED', 'PENDING', 'REJECTED', 'NOT_APPLICABLE']),
          validUntil: z.string().nullable(),
          evidenceId: z.string().nullable(),
        }),
      ),
      coverageStartsAt: z.iso.datetime(),
      coverageEndsAt: z.iso.datetime(),
      mustRemainValidForEntireCoverage: z.boolean().default(true),
    }),
  ),
  (context) => context.json(evaluateEligibility(context.req.valid('json') as never)),
);

engineRoutes.post(
  '/competition/rank',
  requireRoles('ADMIN', 'HR', 'COMMITTEE'),
  zValidator(
    'json',
    z.object({
      candidates: z.array(
        z.object({
          employeeId: z.string(),
          examScore: z.number(),
          criticalSectionScore: z.number().optional(),
          seniorityDate: z.string(),
        }),
      ),
      tieBreakers: z.array(z.object({ type: z.enum(['CRITICAL_SECTION', 'SENIORITY', 'EMPLOYEE_ID']) })),
    }),
  ),
  (context) => {
    const input = context.req.valid('json');
    return context.json(rankCandidates(input.candidates as never, input.tieBreakers));
  },
);

engineRoutes.post(
  '/assignments/plan-chain',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR'),
  zValidator(
    'json',
    z.object({
      vacantLevelId: z.string(),
      stopAfterSourceLevelId: z.string().optional(),
      transitions: z.array(
        z.object({ sourceLevelId: z.string(), targetLevelId: z.string(), active: z.boolean() }),
      ),
    }),
  ),
  (context) => context.json(planCoverageChain(context.req.valid('json') as never)),
);
