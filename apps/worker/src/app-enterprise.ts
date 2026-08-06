import { Hono } from 'hono';
import { createAuditedApp } from './app-audited.js';
import { bulkDataRoutes } from './routes/bulk-data.js';
import type { AppBindings } from './types.js';

export function createEnterpriseApp(): Hono<AppBindings> {
  const app = new Hono<AppBindings>();
  app.route('/api/v1', bulkDataRoutes);
  app.route('/', createAuditedApp());
  return app;
}
