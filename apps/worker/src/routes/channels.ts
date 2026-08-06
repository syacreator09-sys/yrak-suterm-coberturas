import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { authenticate, requireRoles } from '../auth.js';
import { requireIdempotency } from '../idempotency.js';
import type { AppBindings } from '../types.js';

export const channelRoutes = new Hono<AppBindings>();
channelRoutes.use('*', authenticate);
channelRoutes.use('*', requireRoles('ADMIN'));

channelRoutes.get('/email-channels', async (context) => {
  const result = await context.env.DB.prepare(
    `SELECT id, inbound_address, active, created_at
    FROM organization_email_channels WHERE organization_id = ? ORDER BY inbound_address`,
  )
    .bind(context.get('user').organizationId)
    .all();
  return context.json({ items: result.results ?? [] });
});

channelRoutes.post(
  '/email-channels',
  requireIdempotency('CREATE_EMAIL_CHANNEL'),
  zValidator(
    'json',
    z.object({ inboundAddress: z.email().transform((value) => value.toLowerCase()) }),
  ),
  async (context) => {
    const id = crypto.randomUUID();
    const address = context.req.valid('json').inboundAddress;
    await context.env.DB.prepare(
      `INSERT INTO organization_email_channels (
      id, organization_id, inbound_address, active
    ) VALUES (?, ?, ?, 1)`,
    )
      .bind(id, context.get('user').organizationId, address)
      .run();
    return context.json({ id, inboundAddress: address, active: true }, 201);
  },
);
