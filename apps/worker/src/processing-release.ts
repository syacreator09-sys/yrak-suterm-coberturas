import { createEmailPayloadAdapter } from './cloudflare-email-adapter.js';
import { processQueueMessage } from './processing.js';
import type { Env, ProcessingMessage } from './types.js';

export async function processReleaseQueueMessage(
  env: Env,
  message: ProcessingMessage,
): Promise<void> {
  if (message.kind !== 'OUTBOX') {
    await processQueueMessage(env, message);
    return;
  }
  const adapted = new Proxy(env, {
    get(target, property, receiver) {
      if (property === 'EMAIL') {
        return createEmailPayloadAdapter(
          target.EMAIL as unknown as {
            send(message: import('cloudflare:email').EmailMessage): Promise<void>;
          },
        );
      }
      return Reflect.get(target, property, receiver) as unknown;
    },
  });
  await processQueueMessage(adapted, message);
}
