import { Hono } from 'hono';
import { authenticate } from '../auth.js';
import type { AppBindings } from '../types.js';

export const dashboardRoutes = new Hono<AppBindings>();
dashboardRoutes.use('*', authenticate);

dashboardRoutes.get('/dashboard', async (context) => {
  const user = context.get('user');
  const [active, competitions, requirements, pendingApprovals] = await context.env.DB.batch([
    context.env.DB.prepare("SELECT COUNT(*) AS total FROM coverage_cases WHERE group_id IN (SELECT id FROM groups WHERE organization_id = ?) AND status IN ('SCHEDULED','ACTIVE')").bind(user.organizationId),
    context.env.DB.prepare("SELECT COUNT(*) AS total FROM competitions c JOIN coverage_cases cc ON cc.id = c.coverage_case_id JOIN groups g ON g.id = cc.group_id WHERE g.organization_id = ? AND c.status NOT IN ('FINAL','CANCELLED')").bind(user.organizationId),
    context.env.DB.prepare("SELECT COUNT(*) AS total FROM employee_requirements er JOIN employees e ON e.id = er.employee_id WHERE e.organization_id = ? AND er.status IN ('MISSING','EXPIRED','PENDING','REJECTED')").bind(user.organizationId),
    context.env.DB.prepare("SELECT COUNT(*) AS total FROM approvals a WHERE a.status = 'PENDING'")
  ]);
  const total = (result: D1Result<unknown>) => Number((result.results?.[0] as { total?: number } | undefined)?.total ?? 0);
  return context.json({
    activeCoverages: total(active),
    openCompetitions: total(competitions),
    requirementIssues: total(requirements),
    pendingApprovals: total(pendingApprovals),
  });
});
