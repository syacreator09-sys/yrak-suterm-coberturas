import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
import { requireRoles } from '../middleware.js';

export const reportRoutes = new Hono<AppBindings>();
reportRoutes.use('*', requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'AUDITOR', 'COMMITTEE'));

function csv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]!);
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [keys.join(','), ...rows.map((row) => keys.map((key) => escape(row[key])).join(','))].join('\n');
}

function response(rows: Record<string, unknown>[], filename: string) {
  return new Response(csv(rows), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${filename}"` } });
}

function seesAllGroups(role: string): boolean {
  return role === 'ADMIN' || role === 'HR' || role === 'AUDITOR';
}

reportRoutes.get('/employees.csv', async (c) => {
  const user = c.get('user');
  const result = seesAllGroups(user.role)
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
  const result = seesAllGroups(user.role)
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
  if (!seesAllGroups(user.role)) return c.json({ error: 'AUDIT_EXPORT_FORBIDDEN' }, 403);
  const result = await c.env.DB.prepare(`SELECT id,actor_id,actor_role,entity_type,entity_id,action,rule_applied,reason,correlation_id,created_at
    FROM audit_events WHERE organization_id=? ORDER BY created_at,id`)
    .bind(user.organizationId).all<Record<string, unknown>>();
  return response(result.results ?? [], 'audit.csv');
});
