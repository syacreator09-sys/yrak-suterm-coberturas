import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppBindings } from '../env.js';
import { requireRoles } from '../middleware.js';
import { AuditWriter } from '@yrak/audit';
export const appealRoutes=new Hono<AppBindings>();
appealRoutes.post('/',zValidator('json',z.object({coverageCaseId:z.string(),reason:z.string().min(5)})),async c=>{const u=c.get('user'),i=c.req.valid('json');const coverage=await c.env.DB.prepare(`SELECT id FROM coverage_cases WHERE id=? AND organization_id=?`).bind(i.coverageCaseId,u.organizationId).first();if(!coverage)return c.json({error:'COVERAGE_NOT_FOUND'},404);const id=crypto.randomUUID();await c.env.DB.prepare(`INSERT INTO appeals(id,organization_id,coverage_case_id,employee_id,reason,status,created_by) VALUES(?,?,?,?,?,'OPEN',?)`).bind(id,u.organizationId,i.coverageCaseId,u.employeeId??null,i.reason,u.id).run();await new AuditWriter(c.env.DB).append({organizationId:u.organizationId,actorId:u.id,actorRole:u.role,entityType:'APPEAL',entityId:id,action:'OPENED',newValue:i,correlationId:c.get('correlationId')});return c.json({id,status:'OPEN'},201);});
appealRoutes.put('/:appealId/resolve',requireRoles('ADMIN','HR','COMMITTEE'),zValidator('json',z.object({status:z.enum(['RESOLVED','REJECTED']),resolution:z.string().min(3)})),async c=>{const u=c.get('user'),i=c.req.valid('json');const result=await c.env.DB.prepare(`UPDATE appeals SET status=?,resolution=?,decided_by=?,decided_at=datetime('now') WHERE id=? AND organization_id=? AND status IN ('OPEN','UNDER_REVIEW')`).bind(i.status,i.resolution,u.id,c.req.param('appealId'),u.organizationId).run();if(!result.meta.changes)return c.json({error:'APPEAL_NOT_FOUND_OR_CLOSED'},404);return c.json({updated:true});});
