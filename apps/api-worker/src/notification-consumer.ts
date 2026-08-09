import { renderTemplate,type NotificationTemplateKey } from '@yrak/notifications';
import type { AppEnv } from './env.js';
import { resolveEmailSender } from './services/gmail-email-service.js';

export async function processNotification(env:AppEnv,notificationId:string):Promise<void>{
  const row=await env.DB.prepare(`SELECT id,recipient,template_key,payload_json,status FROM notifications WHERE id=?`).bind(notificationId).first<{id:string;recipient:string;template_key:NotificationTemplateKey;payload_json:string;status:string}>();
  if(!row||!['PENDING','FAILED'].includes(row.status))return;
  const email=resolveEmailSender(env);
  if(!email)throw new Error('EMAIL_NOT_CONFIGURED');
  await env.DB.prepare(`UPDATE notifications SET status='PROCESSING',attempts=attempts+1 WHERE id=?`).bind(row.id).run();
  try{const rendered=renderTemplate(row.template_key,JSON.parse(row.payload_json));await email.sender.send({from:email.from,to:row.recipient,subject:rendered.subject,text:rendered.text,...(rendered.html?{html:rendered.html}:{})});await env.DB.prepare(`UPDATE notifications SET status='SENT',sent_at=datetime('now'),last_error=NULL WHERE id=?`).bind(row.id).run();}catch(error){await env.DB.prepare(`UPDATE notifications SET status='FAILED',last_error=? WHERE id=?`).bind(error instanceof Error?error.message:String(error),row.id).run();throw error;}
}
