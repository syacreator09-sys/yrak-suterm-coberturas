import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
import { requireRoles } from '../middleware.js';
export const auditRoutes=new Hono<AppBindings>();
auditRoutes.get('/:entityType/:entityId',requireRoles('ADMIN','HR','AUDITOR','SUPERVISOR','COMMITTEE'),async c=>{const u=c.get('user');const rows=await c.env.DB.prepare(`SELECT id,actor_id,actor_role,action,previous_value_json,new_value_json,rule_applied,reason,correlation_id,created_at FROM audit_events WHERE organization_id=? AND entity_type=? AND entity_id=? ORDER BY created_at,id`).bind(u.organizationId,c.req.param('entityType'),c.req.param('entityId')).all();return c.json({items:rows.results??[]});});
