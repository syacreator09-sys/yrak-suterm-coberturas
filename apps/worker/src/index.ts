import { createApp } from './app.js';
import { processInboundEmail } from './email-intake.js';
import { sweepOutbox } from './outbox.js';
import { processQueueMessage } from './processing.js';
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
    await env.DB.prepare("DELETE FROM idempotency_keys WHERE expires_at < datetime('now')").run();
  },
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    await processInboundEmail(message, env);
  },
} satisfies ExportedHandler<Env>;
