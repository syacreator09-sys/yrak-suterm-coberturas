import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { appendAudit } from '../audit.js';
import { authenticate, requireRoles } from '../auth.js';
import { requireIdempotency } from '../idempotency.js';
import type { AppBindings } from '../types.js';

export const appealRoutes = new Hono<AppBindings>();
appealRoutes.use('*', authenticate);

appealRoutes.get(
  '/appeals',
  requireRoles('ADMIN', 'HR', 'COMMITTEE', 'AUDITOR', 'EMPLOYEE'),
  async (context) => {
    const user = context.get('user');
    const privileged = user.roles.some((role) =>
      ['ADMIN', 'HR', 'COMMITTEE', 'AUDITOR'].includes(role),
    );
    const result = privileged
      ? await context.env.DB.prepare(
          `SELECT a.*, cc.folio, e.name AS employee_name
          FROM appeal_cases a JOIN coverage_cases cc ON cc.id = a.coverage_case_id
          JOIN employees e ON e.id = a.employee_id
          WHERE a.organization_id = ? ORDER BY a.submitted_at DESC LIMIT 300`,
        )
          .bind(user.organizationId)
          .all()
      : await context.env.DB.prepare(
          `SELECT a.*, cc.folio, e.name AS employee_name
          FROM appeal_cases a JOIN coverage_cases cc ON cc.id = a.coverage_case_id
          JOIN employees e ON e.id = a.employee_id
          WHERE a.organization_id = ? AND a.employee_id = ?
          ORDER BY a.submitted_at DESC LIMIT 100`,
        )
          .bind(user.organizationId, user.employeeId)
          .all();
    return context.json({ items: result.results ?? [] });
  },
);

appealRoutes.post(
  '/competitions/:competitionId/appeals',
  requireRoles('ADMIN', 'HR', 'EMPLOYEE'),
  requireIdempotency('SUBMIT_APPEAL'),
  zValidator(
    'json',
    z.object({
      employeeId: z.string(),
      reason: z.string().min(10).max(5000),
      evidenceAttachmentId: z.string().nullable().optional(),
    }),
  ),
  async (context) => {
    const user = context.get('user');
    const input = context.req.valid('json');
    const staff = user.roles.some((role) => ['ADMIN', 'HR'].includes(role));
    if (!staff && user.employeeId !== input.employeeId) {
      return context.json({ error: 'FORBIDDEN' }, 403);
    }
    const competition = await context.env.DB.prepare(
      `SELECT c.id, c.coverage_case_id,
        candidate.employee_id
      FROM competitions c
      JOIN coverage_cases cc ON cc.id = c.coverage_case_id
      JOIN groups g ON g.id = cc.group_id
      JOIN competition_candidates candidate ON candidate.competition_id = c.id
      WHERE c.id = ? AND candidate.employee_id = ? AND g.organization_id = ?`,
    )
      .bind(context.req.param('competitionId'), input.employeeId, user.organizationId)
      .first<{ id: string; coverage_case_id: string; employee_id: string }>();
    if (!competition) {
      return context.json({ error: 'COMPETITION_CANDIDATE_NOT_FOUND' }, 404);
    }
    const id = crypto.randomUUID();
    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO appeal_cases (
        id, organization_id, competition_id, coverage_case_id, employee_id,
        reason, evidence_attachment_id, status, submitted_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?)`,
      ).bind(
        id,
        user.organizationId,
        competition.id,
        competition.coverage_case_id,
        input.employeeId,
        input.reason,
        input.evidenceAttachmentId ?? null,
        user.id,
      ),
      context.env.DB.prepare(
        `INSERT INTO appeal_events (
        id, appeal_id, actor_id, action, reason
      ) VALUES (?, ?, ?, 'SUBMITTED', ?)`,
      ).bind(crypto.randomUUID(), id, user.id, input.reason),
      context.env.DB.prepare(
        `UPDATE coverage_cases
        SET status = 'DISPUTED', version = version + 1, updated_at = datetime('now')
        WHERE id = ? AND status NOT IN ('CANCELLED','COMPLETED')`,
      ).bind(competition.coverage_case_id),
    ]);
    await appendAudit(context.env, {
      organizationId: user.organizationId,
      actor: user,
      entityType: 'APPEAL_CASE',
      entityId: id,
      action: 'SUBMITTED',
      newValue: {
        competitionId: competition.id,
        coverageCaseId: competition.coverage_case_id,
        employeeId: input.employeeId,
      },
      reason: input.reason,
      correlationId: context.get('correlationId'),
    });
    return context.json({ id, status: 'SUBMITTED' }, 201);
  },
);

appealRoutes.post(
  '/appeals/:id/start-review',
  requireRoles('ADMIN', 'HR', 'COMMITTEE'),
  requireIdempotency('START_APPEAL_REVIEW'),
  async (context) => {
    const user = context.get('user');
    const result = await context.env.DB.prepare(
      `UPDATE appeal_cases
      SET status = 'UNDER_REVIEW', version = version + 1, updated_at = datetime('now')
      WHERE id = ? AND organization_id = ? AND status = 'SUBMITTED'`,
    )
      .bind(context.req.param('id'), user.organizationId)
      .run();
    if (Number((result.meta as { changes?: number } | undefined)?.changes ?? 0) === 0) {
      return context.json({ error: 'SUBMITTED_APPEAL_NOT_FOUND' }, 404);
    }
    await context.env.DB.prepare(
      `INSERT INTO appeal_events (
      id, appeal_id, actor_id, action
    ) VALUES (?, ?, ?, 'REVIEW_STARTED')`,
    )
      .bind(crypto.randomUUID(), context.req.param('id'), user.id)
      .run();
    return context.json({ status: 'UNDER_REVIEW' });
  },
);

appealRoutes.post(
  '/appeals/:id/decide',
  requireRoles('ADMIN', 'HR', 'COMMITTEE'),
  requireIdempotency('DECIDE_APPEAL'),
  zValidator(
    'json',
    z.object({
      decision: z.enum(['UPHELD', 'DISMISSED']),
      reason: z.string().min(10).max(5000),
    }),
  ),
  async (context) => {
    const user = context.get('user');
    const input = context.req.valid('json');
    const appeal = await context.env.DB.prepare(
      `SELECT id, submitted_by, coverage_case_id
      FROM appeal_cases WHERE id = ? AND organization_id = ?
        AND status IN ('SUBMITTED','UNDER_REVIEW')`,
    )
      .bind(context.req.param('id'), user.organizationId)
      .first<{ id: string; submitted_by: string; coverage_case_id: string }>();
    if (!appeal) return context.json({ error: 'OPEN_APPEAL_NOT_FOUND' }, 404);
    if (appeal.submitted_by === user.id) {
      return context.json({ error: 'SECOND_REVIEWER_REQUIRED' }, 409);
    }
    await context.env.DB.batch([
      context.env.DB.prepare(
        `UPDATE appeal_cases SET
        status = ?, decided_by = ?, decided_at = datetime('now'), decision_reason = ?,
        version = version + 1, updated_at = datetime('now')
        WHERE id = ? AND organization_id = ? AND status IN ('SUBMITTED','UNDER_REVIEW')`,
      ).bind(input.decision, user.id, input.reason, appeal.id, user.organizationId),
      context.env.DB.prepare(
        `INSERT INTO appeal_events (
        id, appeal_id, actor_id, action, reason
      ) VALUES (?, ?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), appeal.id, user.id, input.decision, input.reason),
    ]);
    await appendAudit(context.env, {
      organizationId: user.organizationId,
      actor: user,
      entityType: 'APPEAL_CASE',
      entityId: appeal.id,
      action: input.decision,
      reason: input.reason,
      correlationId: context.get('correlationId'),
    });
    return context.json({ id: appeal.id, status: input.decision });
  },
);
