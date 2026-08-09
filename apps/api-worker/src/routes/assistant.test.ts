import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { AppBindings, AppEnv, AuthUser } from '../env.js';
import { assistantRoutes } from './assistant.js';

function appWithUser(user: AuthUser) {
  const app = new Hono<AppBindings>();
  app.use('*', async (c, next) => { c.set('user', user); c.set('correlationId', 'test'); await next(); });
  app.route('/', assistantRoutes);
  return app;
}

const baseUser: AuthUser = { id: 'u1', organizationId: 'org1', email: 'a@b.c', role: 'ADMIN' };

describe('assistant route', () => {
  it('calls the AGENT_WORKER service binding (Fetcher), never a plain fetch() to a *.workers.dev URL', async () => {
    // Regression test for the Cloudflare 1042 bug: a global fetch() to another
    // Worker's public *.workers.dev URL is blocked in every real deployment,
    // but silently succeeds under `wrangler dev`, so only asserting on the
    // Fetcher binding actually being invoked prevents this from regressing.
    const fetchSpy = vi.fn(async (_input: string, _init?: RequestInit) => new Response(JSON.stringify({ success: true, data: { result: { answer: 'la respuesta' } } }), { status: 200 }));
    const env = { AGENT_WORKER: { fetch: fetchSpy }, AGENT_API_TOKEN: 'tok' } as unknown as AppEnv;
    const app = appWithUser(baseUser);

    const res = await app.request('/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: '¿Cuántos días?' }) }, env);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain('/v1/support/user-u1');
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { answer: 'la respuesta' } });
  });

  it('returns 503 ASSISTANT_NOT_CONFIGURED when the AGENT_WORKER binding is missing', async () => {
    const env = { AGENT_API_TOKEN: 'tok' } as unknown as AppEnv;
    const app = appWithUser(baseUser);

    const res = await app.request('/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'x' }) }, env);

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ success: false, error: { code: 'ASSISTANT_NOT_CONFIGURED', message: 'Asistente no configurado' } });
  });

  it('propagates an upstream failure as 502 ASSISTANT_UPSTREAM', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ success: false, error: { message: 'boom' } }), { status: 500 }));
    const env = { AGENT_WORKER: { fetch: fetchSpy }, AGENT_API_TOKEN: 'tok' } as unknown as AppEnv;
    const app = appWithUser(baseUser);

    const res = await app.request('/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: 'x' }) }, env);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ success: false, error: { code: 'ASSISTANT_UPSTREAM', message: 'boom' } });
  });
});
