import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from './env.js';
import type { AgentKind } from './session.js';

export const MAX_AGENT_BODY_BYTES = 128 * 1024;
const sessionIdSchema = z.string().min(1).max(160);
const app = new Hono<{ Bindings: Env }>();

export function isKnownAgentKind(value: string): value is AgentKind {
  return ['intake', 'audit', 'communication', 'support'].includes(value);
}

export function isValidSessionId(value: string): boolean {
  return sessionIdSchema.safeParse(value).success;
}

export function exceedsAgentBodyLimit(text: string): boolean {
  return new TextEncoder().encode(text).byteLength > MAX_AGENT_BODY_BYTES;
}

app.get('/health', (c) => c.json({ ok: true, service: 'yrak-suterm-agents' }));

app.get('/ready', async (c) => {
  const tokenConfigured = Boolean(c.env.AGENT_API_TOKEN);
  const organizationConfigured = Boolean(c.env.AGENT_ORGANIZATION_ID && !c.env.AGENT_ORGANIZATION_ID.startsWith('REPLACE_'));
  if (!tokenConfigured || !organizationConfigured) {
    return c.json({ ok: false, service: 'yrak-suterm-agents', database: 'unknown', tokenConfigured, organizationConfigured }, 503);
  }
  try {
    await c.env.DB.prepare('SELECT 1 AS ok').first();
    return c.json({ ok: true, service: 'yrak-suterm-agents', database: 'healthy', tokenConfigured: true, organizationConfigured: true });
  } catch {
    return c.json({ ok: false, service: 'yrak-suterm-agents', database: 'down', tokenConfigured: true, organizationConfigured: true }, 503);
  }
});

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
  const kindValue = c.req.param('kind');
  if (!isKnownAgentKind(kindValue)) return c.json({ error: 'UNKNOWN_AGENT' }, 404);

  const sessionIdValue = c.req.param('sessionId');
  if (!isValidSessionId(sessionIdValue)) return c.json({ error: 'INVALID_SESSION_ID' }, 400);

  const contentLength = Number(c.req.header('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_AGENT_BODY_BYTES) {
    return c.json({ error: 'PAYLOAD_TOO_LARGE' }, 413);
  }

  const raw = await c.req.text();
  if (exceedsAgentBodyLimit(raw)) return c.json({ error: 'PAYLOAD_TOO_LARGE' }, 413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return c.json({ error: 'INVALID_JSON' }, 400);
  }
  const result = z.record(z.unknown()).safeParse(parsed);
  if (!result.success) return c.json({ error: 'INVALID_INPUT' }, 400);

  const stub = c.env.AGENT_SESSION.getByName(`${kindValue}:${sessionIdValue}`);
  return c.json({
    kind: kindValue,
    sessionId: sessionIdValue,
    result: await stub.run(kindValue, c.env.AGENT_ORGANIZATION_ID, result.data),
  });
});

app.get('/v1/:kind/:sessionId/history', async (c) => {
  const kindValue = c.req.param('kind');
  if (!isKnownAgentKind(kindValue)) return c.json({ error: 'UNKNOWN_AGENT' }, 404);
  const sessionIdValue = c.req.param('sessionId');
  if (!isValidSessionId(sessionIdValue)) return c.json({ error: 'INVALID_SESSION_ID' }, 400);
  const stub = c.env.AGENT_SESSION.getByName(`${kindValue}:${sessionIdValue}`);
  return c.json({ items: await stub.getHistory() });
});

export { YrakAgentSession } from './session.js';
export default app;
