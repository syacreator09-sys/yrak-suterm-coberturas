import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppBindings } from '../env.js';
import { requireRoles } from '../middleware.js';
import { createGuestSession } from '../services/guest-session-service.js';
import { AuditWriter } from '@yrak/audit';

export const guestRoutes = new Hono<AppBindings>();

guestRoutes.post(
  '/links',
  requireRoles('ADMIN', 'HR'),
  zValidator('json', z.object({ ttlMinutes: z.number().int().min(5).max(20160).default(4320), label: z.string().max(120).nullable().optional() })),
  async (c) => {
    const u = c.get('user');
    const i = c.req.valid('json');
    const { token, expiresAt } = await createGuestSession(c.env, u.organizationId, u.id, i.ttlMinutes, i.label ?? null);
    await new AuditWriter(c.env.DB).append({
      organizationId: u.organizationId,
      actorId: u.id,
      actorRole: u.role,
      entityType: 'GUEST_SESSION',
      entityId: token.slice(0, 8),
      action: 'GUEST_LINK_CREATED',
      newValue: { expiresAt, label: i.label ?? null },
      ruleApplied: 'GUEST_ACCESS',
      correlationId: c.get('correlationId'),
    });
    return c.json({ token, expiresAt }, 201);
  },
);
