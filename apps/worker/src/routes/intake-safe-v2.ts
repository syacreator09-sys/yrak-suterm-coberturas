import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { authenticate, requireRoles } from '../auth.js';
import { requireIdempotency } from '../idempotency.js';
import { createSafeCoverage } from '../services/coverage-creation-safe.js';
import type { AppBindings } from '../types.js';

async function claimDraft(
  context: Parameters<Parameters<typeof requireRoles>[0] extends never ? never : never>[0] | any,
  draftId: string,
): Promise<boolean> {
  try {
    await context.env.DB.prepare(
      `INSERT INTO intake_review_claims (
      draft_id, claimed_by, expires_at
    ) VALUES (?, ?, datetime('now', '+15 minutes'))`,
    )
      .bind(draftId, context.get('user').id)
      .run();
    return true;
  } catch {
    return false;
  }
}

export const safeIntakeRoutesV2 = new Hono<AppBindings>();
safeIntakeRoutesV2.use('*', authenticate);

safeIntakeRoutesV2.get(
  '/intake-drafts',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'OPERATOR'),
  async (context) => {
    const result = await context.env.DB.prepare(
      `SELECT d.id, d.attachment_id,
        d.source_type, d.draft_json, d.status, d.linked_coverage_case_id,
        d.created_at, d.updated_at, claim.claimed_by, claim.expires_at
      FROM intake_drafts d
      LEFT JOIN intake_review_claims claim ON claim.draft_id = d.id
      WHERE d.organization_id = ?
      ORDER BY d.created_at DESC LIMIT 200`,
    )
      .bind(context.get('user').organizationId)
      .all();
    return context.json({ items: result.results ?? [] });
  },
);

safeIntakeRoutesV2.post(
  '/intake-drafts/:id/approve',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'OPERATOR'),
  requireIdempotency('APPROVE_SAFE_INTAKE_DRAFT_V2'),
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
    const draftId = context.req.param('id');
    const draft = await context.env.DB.prepare(
      `SELECT id, source_type
      FROM intake_drafts
      WHERE id = ? AND organization_id = ? AND status = 'REVIEW_PENDING'`,
    )
      .bind(draftId, user.organizationId)
      .first<{ id: string; source_type: string }>();
    if (!draft) return context.json({ error: 'REVIEW_PENDING_DRAFT_NOT_FOUND' }, 404);
    if (!(await claimDraft(context, draftId))) {
      return context.json({ error: 'DRAFT_ALREADY_CLAIMED' }, 409);
    }

    try {
      const sourceMap: Record<string, 'EMAIL' | 'AUDIO' | 'IMAGE' | 'DOCUMENT' | 'INTEGRATION'> = {
        EMAIL: 'EMAIL',
        AUDIO: 'AUDIO',
        IMAGE: 'IMAGE',
        DOCUMENT: 'DOCUMENT',
      };
      const coverage = await createSafeCoverage(context.env, user, context.get('correlationId'), {
        ...context.req.valid('json'),
        source: sourceMap[draft.source_type] ?? 'INTEGRATION',
      });
      const update = await context.env.DB.prepare(
        `UPDATE intake_drafts
        SET status = 'APPROVED', linked_coverage_case_id = ?, reviewed_by = ?,
            reviewed_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ? AND organization_id = ? AND status = 'REVIEW_PENDING'`,
      )
        .bind(String(coverage.caseId), user.id, draftId, user.organizationId)
        .run();
      if (Number((update.meta as { changes?: number } | undefined)?.changes ?? 0) !== 1) {
        throw new Error('DRAFT_STATE_CHANGED_AFTER_CLAIM');
      }
      await context.env.DB.prepare('DELETE FROM intake_review_claims WHERE draft_id = ?')
        .bind(draftId)
        .run();
      return context.json({ draftId, coverage }, 201);
    } catch (error) {
      await context.env.DB.prepare('DELETE FROM intake_review_claims WHERE draft_id = ?')
        .bind(draftId)
        .run();
      throw error;
    }
  },
);

safeIntakeRoutesV2.post(
  '/intake-drafts/:id/reject',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'OPERATOR'),
  requireIdempotency('REJECT_SAFE_INTAKE_DRAFT_V2'),
  async (context) => {
    const user = context.get('user');
    const draftId = context.req.param('id');
    const exists = await context.env.DB.prepare(
      `SELECT id FROM intake_drafts
      WHERE id = ? AND organization_id = ? AND status = 'REVIEW_PENDING'`,
    )
      .bind(draftId, user.organizationId)
      .first();
    if (!exists) return context.json({ error: 'REVIEW_PENDING_DRAFT_NOT_FOUND' }, 404);
    if (!(await claimDraft(context, draftId))) {
      return context.json({ error: 'DRAFT_ALREADY_CLAIMED' }, 409);
    }
    try {
      const update = await context.env.DB.prepare(
        `UPDATE intake_drafts
        SET status = 'REJECTED', reviewed_by = ?, reviewed_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ? AND organization_id = ? AND status = 'REVIEW_PENDING'`,
      )
        .bind(user.id, draftId, user.organizationId)
        .run();
      if (Number((update.meta as { changes?: number } | undefined)?.changes ?? 0) !== 1) {
        return context.json({ error: 'DRAFT_CONCURRENTLY_REVIEWED' }, 409);
      }
      return context.json({ rejected: true });
    } finally {
      await context.env.DB.prepare('DELETE FROM intake_review_claims WHERE draft_id = ?')
        .bind(draftId)
        .run();
    }
  },
);
