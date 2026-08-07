import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppBindings } from '../env.js';
import { requireRoles, assertGroupAccess } from '../middleware.js';
import { AuditWriter } from '@yrak/audit';

export const configurationRoutes=new Hono<AppBindings>();
configurationRoutes.use('*',requireRoles('ADMIN','HR'));

configurationRoutes.post('/groups',zValidator('json',z.object({name:z.string().min(1),description:z.string().optional()})),async c=>{
  const user=c.get('user'),input=c.req.valid('json'),id=crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO groups(id,organization_id,name,description) VALUES(?,?,?,?)`).bind(id,user.organizationId,input.name,input.description??null).run();
  await new AuditWriter(c.env.DB).append({organizationId:user.organizationId,actorId:user.id,actorRole:user.role,entityType:'GROUP',entityId:id,action:'CREATED',newValue:input,correlationId:c.get('correlationId')});
  return c.json({id,...input},201);
});

configurationRoutes.post('/groups/:groupId/levels',zValidator('json',z.object({number:z.number().int(),name:z.string().min(1),rankOrder:z.number().int()})),async c=>{
  await assertGroupAccess(c,c.req.param('groupId')); const input=c.req.valid('json'),id=crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO levels(id,group_id,level_number,name,rank_order) VALUES(?,?,?,?,?)`).bind(id,c.req.param('groupId'),input.number,input.name,input.rankOrder).run();
  return c.json({id,groupId:c.req.param('groupId'),...input},201);
});

configurationRoutes.post('/groups/:groupId/transitions',zValidator('json',z.object({sourceLevelId:z.string(),targetLevelId:z.string()})),async c=>{
  await assertGroupAccess(c,c.req.param('groupId')); const input=c.req.valid('json');
  const levels=await c.env.DB.prepare(`SELECT id FROM levels WHERE group_id=? AND id IN (?,?)`).bind(c.req.param('groupId'),input.sourceLevelId,input.targetLevelId).all();
  if((levels.results??[]).length!==2) return c.json({error:'LEVEL_GROUP_MISMATCH'},400);
  const id=crypto.randomUUID(); await c.env.DB.prepare(`INSERT INTO level_transitions(id,group_id,source_level_id,target_level_id) VALUES(?,?,?,?)`).bind(id,c.req.param('groupId'),input.sourceLevelId,input.targetLevelId).run();
  return c.json({id,...input},201);
});

configurationRoutes.post('/requirements',zValidator('json',z.object({name:z.string(),requirementType:z.enum(['COURSE','CERTIFICATION','PREREQUISITE_EXAM','DOCUMENT','EXPERIENCE','OTHER']),validityDays:z.number().int().positive().nullable().optional()})),async c=>{
  const input=c.req.valid('json'),user=c.get('user'),id=crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO requirements(id,organization_id,name,requirement_type,validity_days) VALUES(?,?,?,?,?)`).bind(id,user.organizationId,input.name,input.requirementType,input.validityDays??null).run();
  return c.json({id,...input},201);
});

configurationRoutes.put('/levels/:levelId/requirements/:requirementId',zValidator('json',z.object({mandatory:z.boolean().default(true),validForEntireCoverage:z.boolean().default(true)})),async c=>{
  const user=c.get('user'),input=c.req.valid('json');
  const row=await c.env.DB.prepare(`SELECT l.id,g.id group_id FROM levels l JOIN groups g ON g.id=l.group_id JOIN requirements r ON r.id=? WHERE l.id=? AND g.organization_id=? AND r.organization_id=?`).bind(c.req.param('requirementId'),c.req.param('levelId'),user.organizationId,user.organizationId).first<{id:string;group_id:string}>();
  if(!row)return c.json({error:'RESOURCE_SCOPE_MISMATCH'},400);
  await c.env.DB.prepare(`INSERT INTO target_level_requirements(target_level_id,requirement_id,mandatory,valid_for_entire_coverage) VALUES(?,?,?,?) ON CONFLICT(target_level_id,requirement_id) DO UPDATE SET mandatory=excluded.mandatory,valid_for_entire_coverage=excluded.valid_for_entire_coverage`).bind(c.req.param('levelId'),c.req.param('requirementId'),input.mandatory?1:0,input.validForEntireCoverage?1:0).run();
  return c.json({updated:true});
});
