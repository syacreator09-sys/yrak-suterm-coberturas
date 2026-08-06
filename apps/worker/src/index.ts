import { createApp } from './app.js';
import { processAttachment } from './processing.js';
import type { Env, ProcessingMessage } from './types.js';
export { GroupCoordinator } from './durable/group-coordinator.js';
export { CoverageWorkflow } from './workflows/coverage-workflow.js';

const app = createApp();

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<ProcessingMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processAttachment(env, message.body);
        message.ack();
      } catch (error) {
        console.error('attachment processing failed', error);
        message.retry();
      }
    }
  },
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const attachmentId = crypto.randomUUID();
    const r2Key = `inbound-email/${new Date().toISOString().slice(0, 10)}/${attachmentId}.eml`;
    await env.EVIDENCE.put(r2Key, message.raw, {
      httpMetadata: { contentType: 'message/rfc822' },
      customMetadata: { from: message.from, to: message.to },
    });
    await env.DB.prepare(`INSERT INTO messages (
      id, organization_id, channel, direction, recipient, subject, body_text, status
    ) VALUES (?, 'ORG-DEMO', 'EMAIL', 'INBOUND', ?, ?, ?, 'RECEIVED')`)
      .bind(attachmentId, message.to, message.headers.get('subject') ?? null, `Correo almacenado en ${r2Key}`)
      .run();
  },
} satisfies ExportedHandler<Env, ProcessingMessage>;
