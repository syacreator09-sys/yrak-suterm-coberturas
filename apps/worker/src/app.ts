import { Hono } from 'hono';
import { DomainError } from '@yrak/domain';
import type { AppBindings } from './types.js';
import { adminHtml } from './admin.js';
import { healthRoutes } from './routes/health.js';
import { engineRoutes } from './routes/engine.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { uploadRoutes } from './routes/uploads.js';
import { workflowRoutes } from './routes/workflows.js';

export function createApp(): Hono<AppBindings> {
  const app = new Hono<AppBindings>();
  app.route('/', healthRoutes);
  app.get('/admin', (context) => context.html(adminHtml()));
  app.route('/api/v1', dashboardRoutes);
  app.route('/api/v1', engineRoutes);
  app.route('/api/v1', uploadRoutes);
  app.route('/api/v1', workflowRoutes);

  app.notFound((context) => context.json({ error: 'NOT_FOUND' }, 404));
  app.onError((error, context) => {
    console.error(JSON.stringify({
      level: 'error',
      correlationId: context.get('correlationId'),
      message: error.message,
      stack: context.env.ENVIRONMENT === 'production' ? undefined : error.stack,
    }));
    if (error instanceof DomainError) {
      return context.json({ error: error.code, message: error.message, details: error.details }, 422);
    }
    return context.json({ error: 'INTERNAL_ERROR', correlationId: context.get('correlationId') }, 500);
  });
  return app;
}
