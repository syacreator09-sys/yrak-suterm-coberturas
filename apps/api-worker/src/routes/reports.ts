import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
import { hasOrganizationWideRead, requireRoles } from '../middleware.js';
import { recordsToCsv } from '../services/csv-export.js';

export const reportRoutes = new Hono<AppBindings>();
reportRoutes.use('*', requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'AUDITOR', 'COMMITTEE'));

function response(rows: Record<string, unknown>[], filename: string) {
  return new Response(recordsToCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    },
  });
}

reportRoutes.get('/employees.csv', async (c) => {
  const user = c.get('user');
  const result = hasOrganizationWideRead(user.role)
    ? await c.env.DB.prepare(`SELECT employee_number,name,email,group_id,base_level_id,seniority_date,active
        FROM employees WHERE organization_id=? ORDER BY employee_number`)
        .bind(user.organizationId).all<Record<string, unknown>>()
    : await c.env.DB.prepare(`SELECT e.employee_number,e.name,e.email,e.group_id,e.base_level_id,e.seniority_date,e.active
        FROM employees e JOIN user_groups ug ON ug.group_id=e.group_id AND ug.user_id=?
        WHERE e.organization_id=? ORDER BY e.employee_number`)
        .bind(user.id, user.organizationId).all<Record<string, unknown>>();
  return response(result.results ?? [], 'employees.csv');
});

reportRoutes.get('/coverage-cases.csv', async (c) => {
  const user = c.get('user');
  const result = hasOrganizationWideRead(user.role)
    ? await c.env.DB.prepare(`SELECT id,group_id,target_level_id,starts_on,ends_on,effective_days,day_counting_mode,process_type,status,created_at,updated_at
        FROM coverage_cases WHERE organization_id=? ORDER BY created_at`)
        .bind(user.organizationId).all<Record<string, unknown>>()
    : await c.env.DB.prepare(`SELECT c.id,c.group_id,c.target_level_id,c.starts_on,c.ends_on,c.effective_days,c.day_counting_mode,c.process_type,c.status,c.created_at,c.updated_at
        FROM coverage_cases c JOIN user_groups ug ON ug.group_id=c.group_id AND ug.user_id=?
        WHERE c.organization_id=? ORDER BY c.created_at`)
        .bind(user.id, user.organizationId).all<Record<string, unknown>>();
  return response(result.results ?? [], 'coverage-cases.csv');
});

reportRoutes.get('/audit.csv', async (c) => {
  const user = c.get('user');
  if (!hasOrganizationWideRead(user.role)) return c.json({ error: 'AUDIT_EXPORT_FORBIDDEN' }, 403);
  const result = await c.env.DB.prepare(`SELECT id,actor_id,actor_role,entity_type,entity_id,action,rule_applied,reason,correlation_id,created_at
    FROM audit_events WHERE organization_id=? ORDER BY created_at,id`)
    .bind(user.organizationId).all<Record<string, unknown>>();
  return response(result.results ?? [], 'audit.csv');
});
