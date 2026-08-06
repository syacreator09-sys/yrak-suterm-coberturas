import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { authenticate, requireRoles } from '../auth.js';
import { requireIdempotency } from '../idempotency.js';
import { createSafeCoverage } from '../services/coverage-creation-safe.js';
import type { AppBindings } from '../types.js';

export const safeIntakeRoutes = new Hono<AppBindings>();
safeIntakeRoutes.use('*', authenticate);

safeIntakeRoutes.get(
  '/intake-drafts',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'OPERATOR'),
  async (context) => {
    const result = await context.env.DB.prepare(
      `SELECT id, attachment_id, source_type,
        draft_json, status, linked_coverage_case_id, created_at, updated_at
      FROM intake_drafts WHERE organization_id = ?
      ORDER BY created_at DESC LIMIT 200`,
    )
      .bind(context.get('user').organizationId)
      .all();
    return context.json({ items: result.results ?? [] });
  },
);

safeIntakeRoutes.post(
  '/intake-drafts/:id/approve',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'OPERATOR'),
  requireIdempotency('APPROVE_SAFE_INTAKE_DRAFT'),
  zValidator(
    'json',
    z.object({
      absentEmployeeId: z.string(),
      reason: z.string().min(2),
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
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
    const user = context.get('user');
    const draft = await context.env.DB.prepare(
      `SELECT id, source_type
      FROM intake_drafts
      WHERE id = ? AND organization_id = ? AND status = 'REVIEW_PENDING'`,
    )
      .bind(context.req.param('id'), user.organizationId)
      .first<{ id: string; source_type: string }>();
    if (!draft) {
      return context.json({ error: 'REVIEW_PENDING_DRAFT_NOT_FOUND' }, 404);
    }

    const sourceMap: Record<string, 'EMAIL' | 'AUDIO' | 'IMAGE' | 'DOCUMENT' | 'INTEGRATION'> = {
      EMAIL: 'EMAIL',
      AUDIO: 'AUDIO',
      IMAGE: 'IMAGE',
      DOCUMENT: 'DOCUMENT',
    };
    const result = await createSafeCoverage(context.env, user, context.get('correlationId'), {
      ...context.req.valid('json'),
      source: sourceMap[draft.source_type] ?? 'INTEGRATION',
    });

    const update = await context.env.DB.prepare(
      `UPDATE intake_drafts
      SET status = 'APPROVED', linked_coverage_case_id = ?, reviewed_by = ?,
          reviewed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND organization_id = ? AND status = 'REVIEW_PENDING'`,
    )
      .bind(String(result.caseId), user.id, draft.id, user.organizationId)
      .run();
    if (Number((update.meta as { changes?: number } | undefined)?.changes ?? 0) !== 1) {
      return context.json({ error: 'DRAFT_CONCURRENTLY_REVIEWED' }, 409);
    }
    return context.json({ draftId: draft.id, coverage: result }, 201);
  },
);

safeIntakeRoutes.post(
  '/intake-drafts/:id/reject',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'OPERATOR'),
  requireIdempotency('REJECT_SAFE_INTAKE_DRAFT'),
  async (context) => {
    const user = context.get('user');
    const update = await context.env.DB.prepare(
      `UPDATE intake_drafts
      SET status = 'REJECTED', reviewed_by = ?, reviewed_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ? AND organization_id = ? AND status = 'REVIEW_PENDING'`,
    )
      .bind(user.id, context.req.param('id'), user.organizationId)
      .run();
    if (Number((update.meta as { changes?: number } | undefined)?.changes ?? 0) !== 1) {
      return context.json({ error: 'REVIEW_PENDING_DRAFT_NOT_FOUND' }, 404);
    }
    return context.json({ rejected: true });
  },
);
