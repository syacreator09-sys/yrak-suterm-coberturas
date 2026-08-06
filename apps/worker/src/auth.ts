import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { MiddlewareHandler } from 'hono';
import type { AppBindings, AuthenticatedUser, Env } from './types.js';

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(teamDomain: string): ReturnType<typeof createRemoteJWKSet> {
  const normalized = teamDomain.startsWith('http') ? teamDomain : `https://${teamDomain}`;
  const current = jwksCache.get(normalized);
  if (current) return current;
  const jwks = createRemoteJWKSet(new URL(`${normalized}/cdn-cgi/access/certs`));
  jwksCache.set(normalized, jwks);
  return jwks;
}

async function loadUser(env: Env, subject: string): Promise<AuthenticatedUser | null> {
  const row = await env.DB.prepare(
    'SELECT id, organization_id, email, display_name FROM app_users WHERE external_subject = ? AND active = 1',
  )
    .bind(subject)
    .first<{ id: string; organization_id: string; email: string; display_name: string }>();
  if (!row) return null;
  const rolesResult = await env.DB.prepare(
    'SELECT role, group_id FROM user_roles WHERE user_id = ? ORDER BY role',
  )
    .bind(row.id)
    .all<{ role: string; group_id: string | null }>();
  return {
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    displayName: row.display_name,
    roles: (rolesResult.results ?? []).map((item) => item.role),
    groups: (rolesResult.results ?? [])
      .map((item) => item.group_id)
      .filter((value): value is string => value !== null),
  };
}

export const authenticate: MiddlewareHandler<AppBindings> = async (context, next) => {
  context.set('correlationId', context.req.header('x-correlation-id') ?? crypto.randomUUID());

  if (context.env.ENVIRONMENT !== 'production') {
    const testUser = context.req.header('x-test-user');
    if (testUser) {
      context.set('user', {
        id: testUser,
        organizationId: context.req.header('x-test-organization') ?? 'ORG-DEMO',
        email: context.req.header('x-test-email') ?? 'tester@example.com',
        displayName: 'Usuario de prueba',
        roles: (context.req.header('x-test-roles') ?? 'ADMIN').split(','),
        groups: (context.req.header('x-test-groups') ?? '').split(',').filter(Boolean),
      });
      await next();
      return;
    }
  }

  const token = context.req.header('Cf-Access-Jwt-Assertion');
  if (!token || !context.env.CF_ACCESS_TEAM_DOMAIN || !context.env.CF_ACCESS_AUD) {
    return context.json({ error: 'UNAUTHENTICATED', message: 'Autenticación requerida' }, 401);
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(context.env.CF_ACCESS_TEAM_DOMAIN), {
      audience: context.env.CF_ACCESS_AUD,
    });
    if (!payload.sub) throw new Error('JWT sin subject');
    const user = await loadUser(context.env, payload.sub);
    if (!user) return context.json({ error: 'USER_NOT_PROVISIONED' }, 403);
    context.set('user', user);
    await next();
  } catch {
    return context.json({ error: 'INVALID_ACCESS_TOKEN' }, 401);
  }
};

export function requireRoles(...allowedRoles: string[]): MiddlewareHandler<AppBindings> {
  return async (context, next) => {
    const user = context.get('user');
    if (!user.roles.some((role) => allowedRoles.includes(role))) {
      return context.json({ error: 'FORBIDDEN', requiredRoles: allowedRoles }, 403);
    }
    await next();
  };
}
