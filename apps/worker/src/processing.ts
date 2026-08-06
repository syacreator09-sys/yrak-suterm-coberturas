import { WorkersAIProvider } from '@yrak/ai-provider';
import { getGenerativeProvider } from './ai.js';
import { createIntakeDraft } from './intake.js';
import { processOutboxEvent } from './notification-delivery.js';
import type { AttachmentProcessingMessage, Env, ProcessingMessage } from './types.js';

async function processAttachment(env: Env, message: AttachmentProcessingMessage): Promise<void> {
  const object = await env.EVIDENCE.get(message.r2Key);
  if (!object) throw new Error(`R2 object not found: ${message.r2Key}`);
  const bytes = await object.arrayBuffer();
  const generativeProvider = getGenerativeProvider(env);

  if (message.mimeType.startsWith('audio/')) {
    const provider = new WorkersAIProvider(env.AI);
    const result = await provider.transcribe({
      bytes,
      mimeType: message.mimeType,
      language: 'es',
      context:
        'Sistema de coberturas temporales: grupos, niveles, vacaciones, requisitos y concursos.',
    });
    await env.DB.prepare(
      `UPDATE attachments
      SET extraction_status = 'REVIEW_REQUIRED', extracted_text = ?, extraction_confidence = ?
      WHERE id = ?`,
    )
      .bind(result.text, result.confidence ?? null, message.attachmentId)
      .run();
    if (generativeProvider) {
      await createIntakeDraft(env, generativeProvider, {
        attachmentId: message.attachmentId,
        organizationId: message.organizationId,
        mimeType: message.mimeType,
        extractedText: result.text,
      });
    }
    return;
  }

  if (generativeProvider && ['image/jpeg', 'image/png', 'image/webp'].includes(message.mimeType)) {
    await createIntakeDraft(env, generativeProvider, {
      attachmentId: message.attachmentId,
      organizationId: message.organizationId,
      mimeType: message.mimeType,
      bytes,
    });
  }
  await env.DB.prepare("UPDATE attachments SET extraction_status = 'REVIEW_REQUIRED' WHERE id = ?")
    .bind(message.attachmentId)
    .run();
}

export async function processQueueMessage(env: Env, message: ProcessingMessage): Promise<void> {
  if (message.kind === 'OUTBOX') {
    await processOutboxEvent(env, message.outboxEventId);
    return;
  }
  await processAttachment(env, message);
}
