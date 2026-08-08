import { renderTemplate, type NotificationTemplateKey } from '@yrak/notifications';
import type { AppEnv } from './env.js';

function safeFailureCode(error: unknown): string {
  const name = error instanceof Error && error.name ? error.name : 'UNKNOWN_ERROR';
  return name.slice(0, 120);
}

export async function processNotification(env: AppEnv, notificationId: string): Promise<void> {
  const row = await env.DB.prepare(`SELECT id,recipient,template_key,payload_json,status
    FROM notifications WHERE id=?`)
    .bind(notificationId)
    .first<{
      id: string;
      recipient: string;
      template_key: NotificationTemplateKey;
      payload_json: string;
      status: string;
    }>();

  if (!row || !['PENDING', 'FAILED'].includes(row.status)) return;
  if (!env.EMAIL || !env.EMAIL_FROM) throw new Error('EMAIL_NOT_CONFIGURED');

  const claim = await env.DB.prepare(`UPDATE notifications
    SET status='PROCESSING',attempts=attempts+1,last_error=NULL
    WHERE id=? AND status IN('PENDING','FAILED')`)
    .bind(row.id)
    .run();

  if ((claim.meta.changes ?? 0) !== 1) return;

  try {
    const rendered = renderTemplate(row.template_key, JSON.parse(row.payload_json));
    await env.EMAIL.send({
      from: env.EMAIL_FROM,
      to: row.recipient,
      subject: rendered.subject,
      text: rendered.text,
    });
    await env.DB.prepare(`UPDATE notifications
      SET status='SENT',sent_at=datetime('now'),last_error=NULL
      WHERE id=? AND status='PROCESSING'`)
      .bind(row.id)
      .run();
  } catch (error) {
    const failureCode = safeFailureCode(error);
    console.error('NOTIFICATION_SEND_FAILED', row.id, failureCode);
    await env.DB.prepare(`UPDATE notifications
      SET status='FAILED',last_error=?
      WHERE id=? AND status='PROCESSING'`)
      .bind(failureCode, row.id)
      .run();
    throw error;
  }
}
