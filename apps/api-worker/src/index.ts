import { Hono } from 'hono';
import type { AppBindings, AppEnv } from './env.js';
import { apiSecurityHeaders, authenticate, correlation, rejectCrossSiteMutation } from './middleware.js';
import { bootstrapRoutes } from './routes/bootstrap.js';
import { configurationRoutes } from './routes/configuration.js';
import { referenceRoutes } from './routes/reference.js';
import { systemRoutes } from './routes/system.js';
import { employeeRoutes } from './routes/employees.js';
import { coverageRoutes } from './routes/coverages.js';
import { competitionRoutes } from './routes/competitions.js';
import { auditRoutes } from './routes/audit.js';
import { policyRoutes } from './routes/policies.js';
import { meRoutes } from './routes/me.js';
import { appealRoutes } from './routes/appeals.js';
import { attachmentRoutes } from './routes/attachments.js';
import { intakeRoutes } from './routes/intake.js';
import { importRoutes } from './routes/imports.js';
import { reportRoutes } from './routes/reports.js';
import { processNotification } from './notification-consumer.js';
import { processInboundEmail } from './services/inbound-email-service.js';
import { toPublicError } from './services/public-error.js';

const app = new Hono<AppBindings>();
app.use('*', correlation);
app.use('/v1/*', apiSecurityHeaders);
app.use('/v1/*', rejectCrossSiteMutation);
app.use('/bootstrap', apiSecurityHeaders);
app.use('/bootstrap', rejectCrossSiteMutation);

app.get('/health', (c) => c.json({ ok: true, service: 'yrak-suterm-coberturas-api' }));
app.get('/ready', async (c) => {
  try {
    await c.env.DB.prepare('SELECT 1 AS ok').first();
    return c.json({
      ok: true,
      service: 'yrak-suterm-coberturas-api',
      database: 'healthy',
      coordinatorConfigured: Boolean(c.env.GROUP_COORDINATOR),
    });
  } catch {
    return c.json({
      ok: false,
      service: 'yrak-suterm-coberturas-api',
      database: 'down',
      coordinatorConfigured: Boolean(c.env.GROUP_COORDINATOR),
    }, 503);
  }
});

app.route('/bootstrap', bootstrapRoutes);
app.use('/v1/*', authenticate);
app.route('/v1/config', configurationRoutes);
app.route('/v1/reference', referenceRoutes);
app.route('/v1/system', systemRoutes);
app.route('/v1/policies', policyRoutes);
app.route('/v1/employees', employeeRoutes);
app.route('/v1/me', meRoutes);
app.route('/v1/coverage-cases', coverageRoutes);
app.route('/v1/competitions', competitionRoutes);
app.route('/v1/appeals', appealRoutes);
app.route('/v1/attachments', attachmentRoutes);
app.route('/v1/intake', intakeRoutes);
app.route('/v1/import', importRoutes);
app.route('/v1/reports', reportRoutes);
app.route('/v1/audit', auditRoutes);

app.onError((error, c) => {
  const publicError = toPublicError(error);
  console.error(
    publicError.unexpected ? 'UNEXPECTED_API_ERROR' : publicError.code,
    error instanceof Error ? error.name : 'UNKNOWN_ERROR',
  );
  return c.json({ error: publicError.code }, publicError.status);
});

const handler: ExportedHandler<AppEnv> = {
  fetch: (request, env, ctx) => app.fetch(request, env, ctx),
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        await processNotification(env, message.body.notificationId);
        message.ack();
      } catch {
        message.retry();
      }
    }
  },
  async email(message, env) {
    await processInboundEmail(message, env);
  },
};

export { GroupCoordinator } from './group-coordinator.js';
export { CoverageWorkflow } from './workflow.js';
export default handler;
