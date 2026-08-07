import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppBindings } from '../env.js';
import { requireRoles } from '../middleware.js';
export const intakeRoutes=new Hono<AppBindings>();
const draftSchema=z.object({sourceType:z.enum(['TEXT','EMAIL','AUDIO','IMAGE','PDF','SPREADSHEET']),sourceAttachmentId:z.string().nullable().optional(),extracted:z.object({group:z.string().nullable(),targetLevel:z.number().int().nullable(),startDate:z.string().nullable(),endDate:z.string().nullable(),reason:z.string().nullable(),employeeReference:z.string().nullable().optional()}),confidence:z.number().min(0).max(1).nullable().optional()});
intakeRoutes.post('/drafts',requireRoles('ADMIN','HR','SUPERVISOR','OPERATOR'),zValidator('json',draftSchema),async c=>{const u=c.get('user'),i=c.req.valid('json'),id=crypto.randomUUID();await c.env.DB.prepare(`INSERT INTO intake_drafts(id,organization_id,source_type,source_attachment_id,extracted_json,confidence,status,created_by) VALUES(?,?,?,?,?,?,'PENDING_REVIEW',?)`).bind(id,u.organizationId,i.sourceType,i.sourceAttachmentId??null,JSON.stringify(i.extracted),i.confidence??null,u.id).run();return c.json({id,status:'PENDING_REVIEW',extracted:i.extracted},201);});
intakeRoutes.get('/drafts',requireRoles('ADMIN','HR','SUPERVISOR','OPERATOR'),async c=>{const u=c.get('user');const rows=await c.env.DB.prepare(`SELECT id,source_type,source_attachment_id,extracted_json,confidence,status,created_at FROM intake_drafts WHERE organization_id=? ORDER BY created_at DESC LIMIT 100`).bind(u.organizationId).all();return c.json({items:(rows.results??[]).map((r:any)=>({...r,extracted:JSON.parse(r.extracted_json)}))});});
