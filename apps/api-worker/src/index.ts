import { Hono } from 'hono';
import type { AppEnv } from './env.js';

const app = new Hono<{ Bindings: AppEnv }>();

app.get('/health', (c) => c.json({ ok: true, service: 'yrak-suterm-coberturas-api' }));
app.get('/ready', (c) => c.json({ ok: true, databaseConfigured: Boolean(c.env.DB) }));

app.onError((error, c) => {
  console.error(error);
  return c.json({ error: 'INTERNAL_ERROR', message: 'Error interno' }, 500);
});

export default app;
