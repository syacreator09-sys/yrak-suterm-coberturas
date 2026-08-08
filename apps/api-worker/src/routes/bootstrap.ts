import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppBindings, AppEnv } from '../env.js';
import { isLoopbackRequestUrl } from '../middleware.js';

export const bootstrapRoutes = new Hono<AppBindings>();

export function bootstrapEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export function bootstrapAllowed(
  environment: AppEnv['APP_ENV'],
  requestUrl: string,
  enabled: string | undefined,
): boolean {
  if (!bootstrapEnabled(enabled)) return false;
  if (environment === 'production') return false;
  if (environment === 'development') return isLoopbackRequestUrl(requestUrl);
  return environment === 'staging';
}

bootstrapRoutes.post(
  '/',
  zValidator('json', z.object({
    organizationName: z.string().trim().min(2).max(160),
    organizationId: z.string().trim().min(2).max(160).optional(),
    timezone: z.string().trim().min(2).max(100).default('America/Mexico_City'),
    adminEmail: z.string().email().max(320),
    adminDisplayName: z.string().trim().min(2).max(160),
  })),
  async (c) => {
    if (!bootstrapAllowed(c.env.APP_ENV, c.req.url, c.env.BOOTSTRAP_ENABLED)) {
      return c.json({ error: 'BOOTSTRAP_DISABLED' }, 403);
    }
    if (!c.env.BOOTSTRAP_TOKEN || c.req.header('x-yrak-bootstrap-token') !== c.env.BOOTSTRAP_TOKEN) {
      return c.json({ error: 'BOOTSTRAP_UNAUTHORIZED' }, 401);
    }
    const count = await c.env.DB.prepare('SELECT COUNT(*) count FROM organizations').first<{ count: number }>();
    if ((count?.count ?? 0) > 0) return c.json({ error: 'BOOTSTRAP_ALREADY_COMPLETED' }, 409);

    const input = c.req.valid('json');
    const organizationId = input.organizationId ?? crypto.randomUUID();
    const userId = crypto.randomUUID();
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO organizations(id,name,timezone) VALUES(?,?,?)')
        .bind(organizationId, input.organizationName, input.timezone),
      c.env.DB.prepare(`INSERT INTO users(id,organization_id,email,display_name,role) VALUES(?,?,?,?,'ADMIN')`)
        .bind(userId, organizationId, input.adminEmail, input.adminDisplayName),
    ]);
    return c.json({ organizationId, adminUserId: userId, adminEmail: input.adminEmail }, 201);
  },
);
