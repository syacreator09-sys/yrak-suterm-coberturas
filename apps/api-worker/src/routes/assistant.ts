import { Hono } from 'hono';import { z } from 'zod';import { zValidator } from '@hono/zod-validator';import type { AppBindings } from '../env.js';import { requireRoles } from '../middleware.js';

export const assistantRoutes = new Hono<AppBindings>();
assistantRoutes.post('/', requireRoles('ADMIN','HR','SUPERVISOR','COMMITTEE','OPERATOR','EMPLOYEE','AUDITOR'),
  zValidator('json', z.object({ question: z.string().min(1).max(2000) })), async (c) => {
    const u = c.get('user');
    if (!c.env.AGENT_WORKER_URL || !c.env.AGENT_API_TOKEN) return c.json({ success: false, error: { code: 'ASSISTANT_NOT_CONFIGURED', message: 'Asistente no configurado' } }, 503);
    const sessionId = `user-${u.id}`.slice(0, 120);
    const response = await fetch(`${c.env.AGENT_WORKER_URL}/v1/support/${sessionId}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${c.env.AGENT_API_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ question: c.req.valid('json').question }),
    });
    const json = await response.json() as { success?: boolean; data?: { result?: { answer?: string } }; error?: { message?: string } };
    if (!response.ok || !json.success) return c.json({ success: false, error: { code: 'ASSISTANT_UPSTREAM', message: json.error?.message ?? `HTTP ${response.status}` } }, 502);
    return c.json({ success: true, data: { answer: json.data?.result?.answer ?? '' } });
  });
