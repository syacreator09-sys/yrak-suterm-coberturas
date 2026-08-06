import { DomainError } from '@yrak/domain';
import { Hono } from 'hono';
import { adminHtml } from './admin.js';
import { authenticate } from './auth.js';
import { guardCriticalGroupScope } from './group-scope-guard.js';
import { appealRoutes } from './routes/appeals.js';
import { auditRoutes } from './routes/audit.js';
import { bootstrapRoutes } from './routes/bootstrap.js';
import { bulkDataRoutes } from './routes/bulk-data.js';
import { channelRoutes } from './routes/channels.js';
import { competitionRoutes } from './routes/competitions.js';
import { configurationRoutes } from './routes/configuration.js';
import { coverageManagementRoutesV2 } from './routes/coverage-management-v2.js';
import { safeCoverageRoutes } from './routes/coverages-safe.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { dataRoutes } from './routes/data.js';
import { employeeRoutes } from './routes/employees.js';
import { engineRoutes } from './routes/engine.js';
import { healthRoutes } from './routes/health.js';
import { safeIntakeRoutesV3 } from './routes/intake-safe-v3.js';
import { lifecycleRoutes } from './routes/lifecycle.js';
import { operationRoutes } from './routes/operations.js';
import { policyRoutes } from './routes/policies.js';
import { uploadRoutes } from './routes/uploads.js';
import { userRoutes } from './routes/users.js';
import { workflowRoutes } from './routes/workflows.js';
import type { AppBindings } from './types.js';

export function createCleanFinalAppV2(): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.use('*', async (context, next) => {
    context.set('correlationId', context.req.header('x-correlation-id') ?? crypto.randomUUID());
    context.header('x-correlation-id', context.get('correlationId'));
    context.header('x-content-type-options', 'nosniff');
    context.header('referrer-policy', 'no-referrer');
    context.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    context.header(
      'content-security-policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'",
    );
    await next();
  });

  app.use('/api/v1/coverages/*', authenticate, guardCriticalGroupScope);
  app.use('/api/v1/approvals/*', authenticate, guardCriticalGroupScope);

  app.route('/', healthRoutes);
  app.route('/', bootstrapRoutes);
  app.get('/admin', (context) => context.html(adminHtml()));

  app.route('/api/v1', dashboardRoutes);
  app.route('/api/v1', engineRoutes);
  app.route('/api/v1', uploadRoutes);
  app.route('/api/v1', workflowRoutes);
  app.route('/api/v1', configurationRoutes);
  app.route('/api/v1', employeeRoutes);
  app.route('/api/v1', safeCoverageRoutes);
  app.route('/api/v1', coverageManagementRoutesV2);
  app.route('/api/v1', competitionRoutes);
  app.route('/api/v1', auditRoutes);
  app.route('/api/v1', safeIntakeRoutesV3);
  app.route('/api/v1', operationRoutes);
  app.route('/api/v1', dataRoutes);
  app.route('/api/v1', userRoutes);
  app.route('/api/v1', channelRoutes);
  app.route('/api/v1', lifecycleRoutes);
  app.route('/api/v1', policyRoutes);
  app.route('/api/v1', appealRoutes);
  app.route('/api/v1', bulkDataRoutes);

  app.notFound((context) => context.json({ error: 'NOT_FOUND' }, 404));
  app.onError((error, context) => {
    console.error(
      JSON.stringify({
        level: 'error',
        correlationId: context.get('correlationId'),
        message: error.message,
        stack: context.env.ENVIRONMENT === 'production' ? undefined : error.stack,
      }),
    );
    if (error instanceof DomainError) {
      return context.json(
        { error: error.code, message: error.message, details: error.details },
        422,
      );
    }
    return context.json(
      { error: 'INTERNAL_ERROR', correlationId: context.get('correlationId') },
      500,
    );
  });

  return app;
}
