import { Hono } from 'hono';
import { adminUltimateHtml } from './admin-ultimate.js';
import { createCleanFinalAppV2 } from './app-clean-final-v2.js';
import type { AppBindings } from './types.js';

export function createProductionFinalApp(): Hono<AppBindings> {
  const app = new Hono<AppBindings>();
  app.get('/admin', (context) => context.html(adminUltimateHtml()));
  app.route('/', createCleanFinalAppV2());
  return app;
}
