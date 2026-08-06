import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { authenticate, requireRoles } from '../auth.js';
import { requireIdempotency } from '../idempotency.js';
import { decideApproval } from '../services/approval-service.js';
import { cancelCoverage } from '../services/cancellation-service.js';
import type { AppBindings } from '../types.js';

const organizationWideRoles = new Set(['ADMIN', 'HR', 'COMMITTEE', 'AUDITOR']);

function isOrganizationWide(roles: readonly string[]): boolean {
  return roles.some((role) => organizationWideRoles.has(role));
}

async function canActOnCoverage(
  context: Context<AppBindings>,
  coverageCaseId: string,
): Promise<boolean> {
  const user = context.get('user');
  if (isOrganizationWide(user.roles)) return true;
  if (user.groups.length === 0) return false;
  const row = await context.env.DB.prepare(
    `SELECT cc.group_id
    FROM coverage_cases cc JOIN groups g ON g.id = cc.group_id
    WHERE cc.id = ? AND g.organization_id = ?`,
  )
    .bind(coverageCaseId, user.organizationId)
    .first<{ group_id: string }>();
  return Boolean(row && user.groups.includes(row.group_id));
}

export const coverageManagementRoutesV2 = new Hono<AppBindings>();
coverageManagementRoutesV2.use('*', authenticate);

coverageManagementRoutesV2.get(
  '/coverages',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'AUDITOR', 'OPERATOR'),
  async (context) => {
    const user = context.get('user');
    if (!isOrganizationWide(user.roles) && user.groups.length === 0) {
      return context.json({ items: [] });
    }
    const result = isOrganizationWide(user.roles)
      ? await context.env.DB.prepare(
          `SELECT cc.*, a.reason,
            e.name AS absent_employee_name
          FROM coverage_cases cc
          JOIN absences a ON a.id = cc.absence_id
          JOIN employees e ON e.id = a.employee_id
          JOIN groups g ON g.id = cc.group_id
          WHERE g.organization_id = ?
          ORDER BY cc.created_at DESC LIMIT 200`,
        )
          .bind(user.organizationId)
          .all()
      : await context.env.DB.prepare(
          `SELECT cc.*, a.reason,
            e.name AS absent_employee_name
          FROM coverage_cases cc
          JOIN absences a ON a.id = cc.absence_id
          JOIN employees e ON e.id = a.employee_id
          JOIN groups g ON g.id = cc.group_id
          WHERE g.organization_id = ?
            AND cc.group_id IN (${user.groups.map(() => '?').join(',')})
          ORDER BY cc.created_at DESC LIMIT 200`,
        )
          .bind(user.organizationId, ...user.groups)
          .all();
    return context.json({ items: result.results ?? [] });
  },
);

coverageManagementRoutesV2.get(
  '/coverages/:id',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'AUDITOR', 'OPERATOR', 'EMPLOYEE'),
  async (context) => {
    const user = context.get('user');
    const item = await context.env.DB.prepare(
      `SELECT cc.*,
        a.employee_id AS absent_employee_id, a.reason,
        e.name AS absent_employee_name
      FROM coverage_cases cc
      JOIN absences a ON a.id = cc.absence_id
      JOIN employees e ON e.id = a.employee_id
      JOIN groups g ON g.id = cc.group_id
      WHERE cc.id = ? AND g.organization_id = ?`,
    )
      .bind(context.req.param('id'), user.organizationId)
      .first<
        {
          absent_employee_id: string;
          group_id: string;
        } & Record<string, unknown>
      >();
    if (!item) return context.json({ error: 'NOT_FOUND' }, 404);

    const employeeOnly = user.roles.includes('EMPLOYEE') && !isOrganizationWide(user.roles);
    if (employeeOnly) {
      const related = await context.env.DB.prepare(
        `SELECT 1 AS related
        FROM temporary_assignments
        WHERE coverage_case_id = ? AND employee_id = ? LIMIT 1`,
      )
        .bind(context.req.param('id'), user.employeeId)
        .first();
      if (item.absent_employee_id !== user.employeeId && !related) {
        return context.json({ error: 'FORBIDDEN' }, 403);
      }
    } else if (
      !isOrganizationWide(user.roles) &&
      (user.groups.length === 0 || !user.groups.includes(item.group_id))
    ) {
      return context.json({ error: 'GROUP_SCOPE_FORBIDDEN' }, 403);
    }

    const [assignments, approvals, countedDays, audit] = await context.env.DB.batch([
      context.env.DB.prepare(
        `SELECT * FROM temporary_assignments
        WHERE coverage_case_id = ? ORDER BY chain_order`,
      ).bind(context.req.param('id')),
      context.env.DB.prepare(
        `SELECT * FROM approvals
        WHERE entity_type = 'COVERAGE_CASE' AND entity_id = ? ORDER BY requested_at`,
      ).bind(context.req.param('id')),
      context.env.DB.prepare(
        `SELECT counted_date, counting_mode, source
        FROM coverage_counted_days WHERE coverage_case_id = ? ORDER BY counted_date`,
      ).bind(context.req.param('id')),
      context.env.DB.prepare(
        `SELECT actor_id, actor_type, action, rule_applied,
          reason, occurred_at
        FROM audit_events
        WHERE organization_id = ? AND entity_type = 'COVERAGE_CASE' AND entity_id = ?
        ORDER BY occurred_at`,
      ).bind(user.organizationId, context.req.param('id')),
    ]);
    return context.json({
      item,
      assignments: assignments.results ?? [],
      approvals: approvals.results ?? [],
      countedDays: countedDays.results ?? [],
      audit: audit.results ?? [],
    });
  },
);

coverageManagementRoutesV2.post(
  '/coverages/:id/cancel',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR'),
  requireIdempotency('CANCEL_COVERAGE'),
  zValidator(
    'json',
    z.object({ reason: z.string().min(3), cancelAbsence: z.boolean().default(false) }),
  ),
  async (context) => {
    if (!(await canActOnCoverage(context, context.req.param('id')))) {
      return context.json({ error: 'GROUP_SCOPE_FORBIDDEN' }, 403);
    }
    return context.json(
      await cancelCoverage(context.env, context.get('user'), context.get('correlationId'), {
        coverageCaseId: context.req.param('id'),
        ...context.req.valid('json'),
      }),
    );
  },
);

coverageManagementRoutesV2.post(
  '/approvals/:id/decide',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE'),
  requireIdempotency('DECIDE_APPROVAL'),
  zValidator(
    'json',
    z.object({ decision: z.enum(['APPROVED', 'REJECTED']), reason: z.string().min(2) }),
  ),
  async (context) => {
    const approval = await context.env.DB.prepare(
      `SELECT a.entity_id
      FROM approvals a
      JOIN coverage_cases cc ON cc.id = a.entity_id
      JOIN groups g ON g.id = cc.group_id
      WHERE a.id = ? AND a.entity_type = 'COVERAGE_CASE'
        AND g.organization_id = ?`,
    )
      .bind(context.req.param('id'), context.get('user').organizationId)
      .first<{ entity_id: string }>();
    if (!approval) return context.json({ error: 'PENDING_APPROVAL_NOT_FOUND' }, 404);
    if (!(await canActOnCoverage(context, approval.entity_id))) {
      return context.json({ error: 'GROUP_SCOPE_FORBIDDEN' }, 403);
    }
    const input = context.req.valid('json');
    return context.json(
      await decideApproval(
        context.env,
        context.get('user'),
        context.get('correlationId'),
        context.req.param('id'),
        input.decision,
        input.reason,
      ),
    );
  },
);
