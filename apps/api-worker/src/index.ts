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
  console.error(publicError.unexpected ? 'UNEXPECTED_API_ERROR' : publicError.code, error instanceof Error ? error.name : 'UNKNOWN_ERROR');
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
  async scheduled(_event, env) {
    await env.DB.prepare(`UPDATE employee_requirements
      SET status='EXPIRED',version=version+1,updated_at=datetime('now')
      WHERE status='COMPLIANT' AND valid_until IS NOT NULL AND valid_until<date('now')`).run();
    await env.DB.prepare(`UPDATE rotation_queue_entries
      SET status='AVAILABLE',version=version+1
      WHERE status='RESERVED' AND NOT EXISTS(
        SELECT 1 FROM temporary_assignments a
        JOIN rotation_pools p ON p.id=rotation_queue_entries.pool_id
        JOIN coverage_cases c ON c.id=a.coverage_case_id
        WHERE a.employee_id=rotation_queue_entries.employee_id
          AND c.group_id=p.group_id
          AND a.base_level_id=p.source_level_id
          AND a.target_level_id=p.target_level_id
          AND a.status IN('PROPOSED','APPROVED','SCHEDULED','ACTIVE')
      )`).run();
    const failed = await env.DB.prepare(`SELECT id FROM notifications
      WHERE status='FAILED' AND attempts<5 ORDER BY created_at LIMIT 100`).all<{ id: string }>();
    for (const row of failed.results ?? []) await env.NOTIFICATIONS_QUEUE?.send({ notificationId: row.id });
  },
  async email(message, env) {
    await processInboundEmail(message, env);
  },
};

export { GroupCoordinator } from './group-coordinator.js';
export { CoverageWorkflow } from './workflow.js';
export default handler;
