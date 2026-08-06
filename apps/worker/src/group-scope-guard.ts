import type { MiddlewareHandler } from 'hono';
import { authenticate } from './auth.js';
import type { AppBindings } from './types.js';

const organizationWideRoles = new Set(['ADMIN', 'HR', 'COMMITTEE', 'AUDITOR']);

function hasOrganizationWideAccess(roles: readonly string[]): boolean {
  return roles.some((role) => organizationWideRoles.has(role));
}

async function coverageGroup(
  context: Parameters<MiddlewareHandler<AppBindings>>[0],
  coverageCaseId: string,
): Promise<string | null> {
  const row = await context.env.DB.prepare(
    `SELECT cc.group_id
    FROM coverage_cases cc JOIN groups g ON g.id = cc.group_id
    WHERE cc.id = ? AND g.organization_id = ?`,
  )
    .bind(coverageCaseId, context.get('user').organizationId)
    .first<{ group_id: string }>();
  return row?.group_id ?? null;
}

export const guardCriticalGroupScope: MiddlewareHandler<AppBindings> = async (context, next) => {
  const user = context.get('user');
  if (hasOrganizationWideAccess(user.roles)) {
    await next();
    return;
  }

  const path = context.req.path;
  let groupId: string | null = null;

  const approvalMatch = path.match(/^\/api\/v1\/approvals\/([^/]+)\/decide$/);
  if (approvalMatch) {
    const approval = await context.env.DB.prepare(
      `SELECT cc.group_id
      FROM approvals a JOIN coverage_cases cc ON cc.id = a.entity_id
      JOIN groups g ON g.id = cc.group_id
      WHERE a.id = ? AND a.entity_type = 'COVERAGE_CASE'
        AND g.organization_id = ?`,
    )
      .bind(approvalMatch[1], user.organizationId)
      .first<{ group_id: string }>();
    groupId = approval?.group_id ?? null;
  }

  const coverageMatch = path.match(/^\/api\/v1\/coverages\/([^/]+)\/(?:cancel|complete-early)$/);
  if (coverageMatch) {
    groupId = await coverageGroup(context, coverageMatch[1] ?? '');
  }

  if (groupId === null) {
    await next();
    return;
  }
  if (user.groups.length === 0 || !user.groups.includes(groupId)) {
    return context.json({ error: 'GROUP_SCOPE_FORBIDDEN' }, 403);
  }
  await next();
};

export const authenticateCriticalScope: MiddlewareHandler<AppBindings> = async (context, next) =>
  authenticate(context, next);
