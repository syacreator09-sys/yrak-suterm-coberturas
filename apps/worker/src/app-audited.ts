import { Hono } from 'hono';
import { createFinalApp } from './app-final.js';
import { authenticate } from './auth.js';
import { guardCriticalGroupScope } from './group-scope-guard.js';
import type { AppBindings } from './types.js';

export function createAuditedApp(): Hono<AppBindings> {
  const app = new Hono<AppBindings>();
  app.use('/api/v1/approvals/*', authenticate, guardCriticalGroupScope);
  app.use('/api/v1/coverages/*', authenticate, guardCriticalGroupScope);
  app.route('/', createFinalApp());
  return app;
}
