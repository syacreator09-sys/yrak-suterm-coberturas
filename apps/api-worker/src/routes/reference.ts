import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
import { assertGroupAccess, hasOrganizationWideRead, requireRoles } from '../middleware.js';

export const referenceRoutes = new Hono<AppBindings>();
referenceRoutes.use('*', requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'OPERATOR', 'AUDITOR'));

referenceRoutes.get('/groups', async (c) => {
  const user = c.get('user');
  if (hasOrganizationWideRead(user.role)) {
    const rows = await c.env.DB.prepare(`SELECT id,name,description,active
      FROM groups WHERE organization_id=? AND active=1 ORDER BY name`)
      .bind(user.organizationId).all();
    return c.json({ items: rows.results ?? [] });
  }
  const rows = await c.env.DB.prepare(`SELECT g.id,g.name,g.description,g.active
    FROM groups g JOIN user_groups ug ON ug.group_id=g.id
    WHERE g.organization_id=? AND g.active=1 AND ug.user_id=? ORDER BY g.name`)
    .bind(user.organizationId, user.id).all();
  return c.json({ items: rows.results ?? [] });
});

referenceRoutes.get('/groups/:groupId/levels', async (c) => {
  await assertGroupAccess(c, c.req.param('groupId'));
  const rows = await c.env.DB.prepare(`SELECT id,level_number,name,rank_order,active
    FROM levels WHERE group_id=? AND active=1 ORDER BY rank_order`)
    .bind(c.req.param('groupId')).all();
  return c.json({ items: rows.results ?? [] });
});

referenceRoutes.get('/requirements', async (c) => {
  const user = c.get('user');
  const rows = await c.env.DB.prepare(`SELECT id,name,requirement_type,validity_days,active,version
    FROM requirements WHERE organization_id=? AND active=1 ORDER BY name`)
    .bind(user.organizationId).all();
  return c.json({ items: rows.results ?? [] });
});

referenceRoutes.get('/groups/:groupId/rotation-pools', async (c) => {
  const user = c.get('user');
  const groupId = c.req.param('groupId');
  await assertGroupAccess(c, groupId);
  const rows = await c.env.DB.prepare(`SELECT id,source_level_id,target_level_id,active
    FROM rotation_pools WHERE organization_id=? AND group_id=? AND active=1 ORDER BY id`)
    .bind(user.organizationId, groupId).all();
  return c.json({ items: rows.results ?? [] });
});

referenceRoutes.get('/rotation-pools/:poolId/queue', async (c) => {
  const user = c.get('user');
  const pool = await c.env.DB.prepare(`SELECT id,group_id FROM rotation_pools
    WHERE id=? AND organization_id=? AND active=1`)
    .bind(c.req.param('poolId'), user.organizationId)
    .first<{ id: string; group_id: string }>();
  if (!pool) return c.json({ error: 'ROTATION_POOL_NOT_FOUND' }, 404);
  await assertGroupAccess(c, pool.group_id);
  const rows = await c.env.DB.prepare(`SELECT q.employee_id,e.employee_number,e.name,q.queue_position,
      q.status,q.last_coverage_at,q.times_selected
    FROM rotation_queue_entries q JOIN employees e ON e.id=q.employee_id
    WHERE q.pool_id=? ORDER BY q.queue_position`)
    .bind(pool.id).all();
  return c.json({ items: rows.results ?? [] });
});
