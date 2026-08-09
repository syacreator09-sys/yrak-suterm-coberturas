import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from './env.js';
import type { AgentKind } from './session.js';

const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => c.json({ ok: true, service: 'yrak-suterm-agents' }));

app.use('/v1/*', async (c, next) => {
  if (!c.env.AGENT_API_TOKEN || c.req.header('authorization') !== `Bearer ${c.env.AGENT_API_TOKEN}`) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'UNAUTHORIZED' } }, 401);
  }
  if (!c.env.AGENT_ORGANIZATION_ID || c.env.AGENT_ORGANIZATION_ID.startsWith('REPLACE_')) {
    return c.json(
      { success: false, error: { code: 'AGENT_ORGANIZATION_NOT_CONFIGURED', message: 'AGENT_ORGANIZATION_NOT_CONFIGURED' } },
      503,
    );
  }
  await next();
});

app.post('/v1/:kind/:sessionId', async (c) => {
  const kind = c.req.param('kind') as AgentKind;
  if (!['intake', 'audit', 'communication', 'support'].includes(kind)) {
    return c.json({ success: false, error: { code: 'UNKNOWN_AGENT', message: 'UNKNOWN_AGENT' } }, 404);
  }
  const sessionId = z.string().min(1).max(160).parse(c.req.param('sessionId'));
  const input = z.record(z.unknown()).parse(await c.req.json());
  const stub = c.env.AGENT_SESSION.getByName(`${kind}:${sessionId}`);
  const result = await stub.run(kind, c.env.AGENT_ORGANIZATION_ID, input);
  return c.json({ success: true, data: { kind, sessionId, result } });
});

app.get('/v1/:kind/:sessionId/history', async (c) => {
  const kind = c.req.param('kind') as AgentKind;
  if (!['intake', 'audit', 'communication', 'support'].includes(kind)) {
    return c.json({ success: false, error: { code: 'UNKNOWN_AGENT', message: 'UNKNOWN_AGENT' } }, 404);
  }
  const stub = c.env.AGENT_SESSION.getByName(`${kind}:${c.req.param('sessionId')}`);
  const items = await stub.getHistory();
  return c.json({ success: true, data: { items } });
});

app.onError((error, c) =>
  c.json(
    {
      success: false,
      error: {
        code: error instanceof Error ? error.message.split(':')[0] : 'AGENT_ERROR',
        message: error instanceof Error ? error.message : 'error',
      },
    },
    400,
  ),
);

export { YrakAgentSession } from './session.js';
export default app;
