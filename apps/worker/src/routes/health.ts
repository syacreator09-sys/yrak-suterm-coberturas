import { Hono } from 'hono';
import type { AppBindings } from '../types.js';

export const healthRoutes = new Hono<AppBindings>();

healthRoutes.get('/health', (context) =>
  context.json({ status: 'ok', service: 'yrak-suterm-coberturas', time: new Date().toISOString() }),
);

healthRoutes.get('/ready', async (context) => {
  try {
    await context.env.DB.prepare('SELECT 1 AS ready').first();
    return context.json({ status: 'ready' });
  } catch {
    return context.json({ status: 'not-ready', dependency: 'D1' }, 503);
  }
});
