import type { Context, Next } from 'hono';
import type { AppBindings, AuthUser } from './env.js';

export function hasOrganizationWideRead(role: AuthUser['role']): boolean {
  return role === 'ADMIN' || role === 'HR' || role === 'AUDITOR';
}

export async function correlation(context: Context<AppBindings>, next: Next): Promise<void> {
  context.set('correlationId', context.req.header('x-correlation-id') ?? crypto.randomUUID());
  await next();
  context.header('x-correlation-id', context.get('correlationId'));
}

export async function authenticate(context: Context<AppBindings>, next: Next): Promise<Response | void> {
  const accessEmail = context.req.header('Cf-Access-Authenticated-User-Email');
  const developmentEmail = context.env.APP_ENV === 'development' ? context.req.header('x-yrak-user-email') : undefined;
  const email = accessEmail ?? developmentEmail;
  if (!email) return context.json({ error: 'UNAUTHENTICATED' }, 401);
  const row = await context.env.DB.prepare(`SELECT id, organization_id, email, role, employee_id
    FROM users WHERE lower(email) = lower(?) AND active = 1`).bind(email).first<{ id:string; organization_id:string; email:string; role:AuthUser['role']; employee_id:string | null }>();
  if (!row) return context.json({ error: 'USER_NOT_PROVISIONED' }, 403);
  context.set('user', { id: row.id, organizationId: row.organization_id, email: row.email, role: row.role, ...(row.employee_id ? { employeeId: row.employee_id } : {}) });
  await next();
}

export function requireRoles(...roles: AuthUser['role'][]) {
  return async (context: Context<AppBindings>, next: Next): Promise<Response | void> => {
    if (!roles.includes(context.get('user').role)) return context.json({ error: 'FORBIDDEN' }, 403);
    await next();
  };
}

export async function assertGroupAccess(context: Context<AppBindings>, groupId: string): Promise<void> {
  const user = context.get('user');
  const group = await context.env.DB.prepare('SELECT id FROM groups WHERE id = ? AND organization_id = ? AND active = 1').bind(groupId, user.organizationId).first();
  if (!group) throw new Error('GROUP_NOT_FOUND');
  if (hasOrganizationWideRead(user.role)) return;
  const access = await context.env.DB.prepare('SELECT 1 AS ok FROM user_groups WHERE user_id = ? AND group_id = ?').bind(user.id, groupId).first();
  if (!access) throw new Error('GROUP_FORBIDDEN');
}
