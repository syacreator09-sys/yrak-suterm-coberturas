import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppBindings } from '../types.js';

export const bootstrapRoutes = new Hono<AppBindings>();

bootstrapRoutes.post(
  '/bootstrap',
  zValidator(
    'json',
    z.object({
      organizationName: z.string().min(2),
      timezone: z.string().default('America/Mexico_City'),
      externalSubject: z.string().min(1),
      email: z.email(),
      displayName: z.string().min(2),
    }),
  ),
  async (context) => {
    const token = context.req.header('authorization')?.replace(/^Bearer\s+/i, '');
    if (!context.env.BOOTSTRAP_TOKEN || token !== context.env.BOOTSTRAP_TOKEN) {
      return context.json({ error: 'INVALID_BOOTSTRAP_TOKEN' }, 401);
    }
    const count = await context.env.DB.prepare('SELECT COUNT(*) AS total FROM app_users')
      .first<{ total: number }>();
    if ((count?.total ?? 0) > 0) return context.json({ error: 'BOOTSTRAP_ALREADY_COMPLETED' }, 409);
    const input = context.req.valid('json');
    const organizationId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    await context.env.DB.batch([
      context.env.DB.prepare('INSERT INTO organizations (id, name, timezone) VALUES (?, ?, ?)').bind(organizationId, input.organizationName, input.timezone),
      context.env.DB.prepare(`INSERT INTO app_users (
        id, organization_id, external_subject, email, display_name, active
      ) VALUES (?, ?, ?, ?, ?, 1)`).bind(userId, organizationId, input.externalSubject, input.email, input.displayName),
      context.env.DB.prepare("INSERT INTO user_roles (user_id, role, group_id) VALUES (?, 'ADMIN', NULL)").bind(userId),
      context.env.DB.prepare('INSERT INTO organization_policies (organization_id, updated_by) VALUES (?, ?)').bind(organizationId, userId),
    ]);
    return context.json({ organizationId, userId, role: 'ADMIN' }, 201);
  },
);
