import { WorkersAIProvider } from '@yrak/ai-provider';
import type { Env, ProcessingMessage } from './types.js';

export async function processAttachment(env: Env, message: ProcessingMessage): Promise<void> {
  const object = await env.EVIDENCE.get(message.r2Key);
  if (!object) throw new Error(`R2 object not found: ${message.r2Key}`);
  const bytes = await object.arrayBuffer();

  if (message.mimeType.startsWith('audio/')) {
    const provider = new WorkersAIProvider(env.AI);
    const result = await provider.transcribe({
      bytes,
      mimeType: message.mimeType,
      language: 'es',
      context: 'Sistema de coberturas temporales: grupos, niveles, vacaciones, requisitos y concursos.',
    });
    await env.DB.prepare(`UPDATE attachments
      SET extraction_status = 'REVIEW_REQUIRED', extracted_text = ?, extraction_confidence = ?
      WHERE id = ?`)
      .bind(result.text, result.confidence ?? null, message.attachmentId)
      .run();
    return;
  }

  await env.DB.prepare("UPDATE attachments SET extraction_status = 'REVIEW_REQUIRED' WHERE id = ?")
    .bind(message.attachmentId)
    .run();
}
