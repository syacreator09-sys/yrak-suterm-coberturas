import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from './env.js';
import type { AgentKind } from './session.js';

const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => c.json({ ok: true, service: 'yrak-suterm-agents' }));

app.use('/v1/*', async (c, next) => {
  if (!c.env.AGENT_API_TOKEN || c.req.header('authorization') !== `Bearer ${c.env.AGENT_API_TOKEN}`) {
    return c.json({ error: 'UNAUTHORIZED' }, 401);
  }
  if (!c.env.AGENT_ORGANIZATION_ID || c.env.AGENT_ORGANIZATION_ID.startsWith('REPLACE_')) {
    return c.json({ error: 'AGENT_ORGANIZATION_NOT_CONFIGURED' }, 503);
  }
  await next();
});

app.post('/v1/:kind/:sessionId', async (c) => {
  const kind = c.req.param('kind') as AgentKind;
  if (!['intake', 'audit', 'communication', 'support'].includes(kind)) {
    return c.json({ error: 'UNKNOWN_AGENT' }, 404);
  }
  const sessionId = z.string().min(1).max(160).parse(c.req.param('sessionId'));
  const input = z.record(z.unknown()).parse(await c.req.json());
  const stub = c.env.AGENT_SESSION.getByName(`${kind}:${sessionId}`);
  return c.json({
    kind,
    sessionId,
    result: await stub.run(kind, c.env.AGENT_ORGANIZATION_ID, input),
  });
});

app.get('/v1/:kind/:sessionId/history', async (c) => {
  const kind = c.req.param('kind') as AgentKind;
  if (!['intake', 'audit', 'communication', 'support'].includes(kind)) {
    return c.json({ error: 'UNKNOWN_AGENT' }, 404);
  }
  const stub = c.env.AGENT_SESSION.getByName(`${kind}:${c.req.param('sessionId')}`);
  return c.json({ items: await stub.getHistory() });
});

export { YrakAgentSession } from './session.js';
export default app;
