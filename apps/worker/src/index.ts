import { createApp } from './app.js';
import { processQueueMessage } from './processing.js';
import { sweepOutbox } from './outbox.js';
import type { Env, ProcessingMessage } from './types.js';
export { GroupCoordinator } from './durable/group-coordinator.js';
export { CoverageWorkflow } from './workflows/coverage-workflow.js';

const app = createApp();

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<ProcessingMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processQueueMessage(env, message.body);
        message.ack();
      } catch (error) {
        console.error('queue processing failed', error);
        message.retry();
      }
    }
  },
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await sweepOutbox(env);
  },
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const channel = await env.DB.prepare(`SELECT organization_id
      FROM organization_email_channels WHERE inbound_address = ? AND active = 1`)
      .bind(message.to.toLowerCase())
      .first<{ organization_id: string }>();
    if (!channel) {
      message.setReject('Dirección de entrada no configurada');
      return;
    }
    const attachmentId = crypto.randomUUID();
    const r2Key = `${channel.organization_id}/inbound-email/${new Date().toISOString().slice(0, 10)}/${attachmentId}.eml`;
    await env.EVIDENCE.put(r2Key, message.raw, {
      httpMetadata: { contentType: 'message/rfc822' },
      customMetadata: { from: message.from, to: message.to },
    });
    await env.DB.prepare(`INSERT INTO messages (
      id, organization_id, channel, direction, recipient, subject, body_text, status
    ) VALUES (?, ?, 'EMAIL', 'INBOUND', ?, ?, ?, 'RECEIVED')`)
      .bind(
        attachmentId,
        channel.organization_id,
        message.to,
        message.headers.get('subject') ?? null,
        `Correo almacenado en ${r2Key}`,
      )
      .run();
  },
} satisfies ExportedHandler<Env>;
