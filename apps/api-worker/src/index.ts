import { Hono } from 'hono';
import type { AppBindings,AppEnv } from './env.js';
import { authenticate,correlation } from './middleware.js';
import { configurationRoutes } from './routes/configuration.js';
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
import { processNotification } from './notification-consumer.js';

const app=new Hono<AppBindings>();
app.use('*',correlation);
app.get('/health',c=>c.json({ok:true,service:'yrak-suterm-coberturas-api'}));
app.get('/ready',c=>c.json({ok:true,databaseConfigured:Boolean(c.env.DB),coordinatorConfigured:Boolean(c.env.GROUP_COORDINATOR)}));
app.use('/v1/*',authenticate);
app.route('/v1/config',configurationRoutes);app.route('/v1/policies',policyRoutes);app.route('/v1/employees',employeeRoutes);app.route('/v1/me',meRoutes);app.route('/v1/coverage-cases',coverageRoutes);app.route('/v1/competitions',competitionRoutes);app.route('/v1/appeals',appealRoutes);app.route('/v1/attachments',attachmentRoutes);app.route('/v1/intake',intakeRoutes);app.route('/v1/import',importRoutes);app.route('/v1/audit',auditRoutes);
app.onError((error,c)=>{console.error(error);const message=error instanceof Error?error.message:'INTERNAL_ERROR';return c.json({error:message},message.endsWith('_NOT_FOUND')?404:message.endsWith('_FORBIDDEN')?403:400);});

const handler:ExportedHandler<AppEnv>={
  fetch:(request,env,ctx)=>app.fetch(request,env,ctx),
  async queue(batch,env){for(const message of batch.messages){try{await processNotification(env,message.body.notificationId);message.ack();}catch{message.retry();}}},
  async scheduled(_event,env){await env.DB.prepare(`UPDATE employee_requirements SET status='EXPIRED',version=version+1,updated_at=datetime('now') WHERE status='COMPLIANT' AND valid_until IS NOT NULL AND valid_until < date('now')`).run();const failed=await env.DB.prepare(`SELECT id FROM notifications WHERE status='FAILED' AND attempts<5 ORDER BY created_at LIMIT 100`).all<{id:string}>();for(const row of failed.results??[])await env.NOTIFICATIONS_QUEUE?.send({notificationId:row.id});},
  async email(message,env){const raw=await new Response(message.raw).arrayBuffer();const attachmentId=crypto.randomUUID();const organization=await env.DB.prepare(`SELECT id FROM organizations WHERE active=1 ORDER BY created_at LIMIT 1`).first<{id:string}>();if(!organization||!env.EVIDENCE_BUCKET)return;const key=`${organization.id}/EMAIL/inbound/${attachmentId}.eml`;await env.EVIDENCE_BUCKET.put(key,raw,{httpMetadata:{contentType:'message/rfc822'}});await env.DB.prepare(`INSERT INTO attachments(id,organization_id,entity_type,entity_id,original_filename,mime_type,byte_size,sha256,r2_key,uploaded_by) VALUES(?,?, 'INBOUND_EMAIL', ?, ?, 'message/rfc822', ?, '', ?, 'SYSTEM')`).bind(attachmentId,organization.id,attachmentId,`email-${Date.now()}.eml`,raw.byteLength,key).run();await env.DB.prepare(`INSERT INTO intake_drafts(id,organization_id,source_type,source_attachment_id,extracted_json,status,created_by) VALUES(?,?,'EMAIL',?,?, 'PENDING_REVIEW','SYSTEM')`).bind(crypto.randomUUID(),organization.id,attachmentId,JSON.stringify({from:message.from,to:message.to,subject:message.headers.get('subject')??null})).run();}
};
export { GroupCoordinator } from './group-coordinator.js';export { CoverageWorkflow } from './workflow.js';export default handler;
