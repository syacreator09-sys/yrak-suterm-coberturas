import { Hono } from 'hono';
import { authenticate, requireRoles } from '../auth.js';
import type { AppBindings } from '../types.js';

export const auditRoutes = new Hono<AppBindings>();
auditRoutes.use('*', authenticate);
auditRoutes.use('*', requireRoles('ADMIN', 'HR', 'AUDITOR'));

auditRoutes.get('/audit', async (context) => {
  const entityType = context.req.query('entityType');
  const entityId = context.req.query('entityId');
  const conditions = ['organization_id = ?'];
  const values: unknown[] = [context.get('user').organizationId];
  if (entityType) {
    conditions.push('entity_type = ?');
    values.push(entityType);
  }
  if (entityId) {
    conditions.push('entity_id = ?');
    values.push(entityId);
  }
  const result = await context.env.DB.prepare(
    `SELECT * FROM audit_events
    WHERE ${conditions.join(' AND ')} ORDER BY occurred_at DESC LIMIT 500`,
  )
    .bind(...values)
    .all();
  return context.json({ items: result.results ?? [] });
});
