import type { Context, Next } from 'hono';
import type { AppBindings, AuthUser } from './env.js';
import { AccessJwtValidationError, verifyAccessJwt } from './services/access-jwt.js';

const ACCESS_SERVICE_ERROR_CODES = new Set([
  'ACCESS_TEAM_DOMAIN_REQUIRED',
  'ACCESS_TEAM_DOMAIN_INVALID',
  'ACCESS_JWKS_UNAVAILABLE',
  'ACCESS_JWKS_INVALID',
  'ACCESS_JWK_INVALID',
]);

export function hasOrganizationWideRead(role: AuthUser['role']): boolean {
  return role === 'ADMIN' || role === 'HR' || role === 'AUDITOR';
}

export function isCrossSiteMutation(method: string, secFetchSite: string | undefined): boolean {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD' || normalizedMethod === 'OPTIONS') return false;
  return secFetchSite?.toLowerCase() === 'cross-site';
}

export function isLoopbackRequestUrl(requestUrl: string): boolean {
  try {
    const hostname = new URL(requestUrl).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

export function accessFailureStatus(error: AccessJwtValidationError): 401 | 503 {
  return ACCESS_SERVICE_ERROR_CODES.has(error.code) ? 503 : 401;
}

export async function correlation(context: Context<AppBindings>, next: Next): Promise<void> {
  context.set('correlationId', context.req.header('x-correlation-id') ?? crypto.randomUUID());
  await next();
  context.header('x-correlation-id', context.get('correlationId'));
}

export async function apiSecurityHeaders(context: Context<AppBindings>, next: Next): Promise<void> {
  await next();
  context.header('cache-control', 'private, no-store');
  context.header('x-content-type-options', 'nosniff');
  context.header('x-frame-options', 'DENY');
  context.header('referrer-policy', 'no-referrer');
}

export async function rejectCrossSiteMutation(context: Context<AppBindings>, next: Next): Promise<Response | void> {
  if (isCrossSiteMutation(context.req.method, context.req.header('Sec-Fetch-Site'))) {
    return context.json({ error: 'CROSS_SITE_MUTATION_FORBIDDEN' }, 403);
  }
  await next();
}

export async function authenticate(context: Context<AppBindings>, next: Next): Promise<Response | void> {
  let email: string | undefined;
  const localDevelopment = context.env.APP_ENV === 'development' && isLoopbackRequestUrl(context.req.url);

  if (localDevelopment) {
    email = context.req.header('x-yrak-user-email') ?? undefined;
    if (!email) return context.json({ error: 'UNAUTHENTICATED' }, 401);
  } else {
    const teamDomain = context.env.ACCESS_TEAM_DOMAIN?.trim();
    const audience = context.env.ACCESS_AUD?.trim();
    if (!teamDomain || !audience || audience.startsWith('REPLACE_')) {
      return context.json({ error: 'ACCESS_NOT_CONFIGURED' }, 503);
    }
    const token = context.req.header('Cf-Access-Jwt-Assertion');
    if (!token) return context.json({ error: 'UNAUTHENTICATED' }, 401);
    try {
      const claims = await verifyAccessJwt(token, { teamDomain, audience });
      email = claims.email;
    } catch (error) {
      if (error instanceof AccessJwtValidationError) {
        const status = accessFailureStatus(error);
        return context.json({ error: status === 503 ? 'ACCESS_UNAVAILABLE' : 'UNAUTHENTICATED' }, status);
      }
      return context.json({ error: 'ACCESS_UNAVAILABLE' }, 503);
    }
  }

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
