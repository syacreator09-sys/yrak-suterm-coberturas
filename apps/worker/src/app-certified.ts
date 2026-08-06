import { Hono } from 'hono';
import { createEnterpriseApp } from './app-enterprise.js';
import { safeCoverageRoutes } from './routes/coverages-safe.js';
import type { AppBindings } from './types.js';

export function createCertifiedApp(): Hono<AppBindings> {
  const app = new Hono<AppBindings>();
  app.route('/api/v1', safeCoverageRoutes);
  app.route('/', createEnterpriseApp());
  return app;
}
