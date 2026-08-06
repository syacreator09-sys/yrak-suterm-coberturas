import { IntakeAgent } from '@yrak/agents';
import type { IntakeDraft } from '@yrak/agents';
import type { AIProvider } from '@yrak/ai-provider';
import type { Env } from './types.js';

export async function createIntakeDraft(
  env: Env,
  provider: AIProvider,
  input: {
    attachmentId: string;
    organizationId: string;
    mimeType: string;
    bytes?: ArrayBuffer;
    extractedText?: string;
    sourceOverride?: IntakeDraft['source'];
  },
): Promise<{ id: string; draft: IntakeDraft }> {
  const agent = new IntakeAgent(provider);
  let draft: IntakeDraft;
  if (input.bytes && ['image/jpeg', 'image/png', 'image/webp'].includes(input.mimeType)) {
    draft = await agent.fromImage(
      input.bytes,
      input.mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
    );
  } else if (input.extractedText) {
    const source =
      input.sourceOverride ?? (input.mimeType.startsWith('audio/') ? 'AUDIO' : 'DOCUMENT');
    draft = await agent.fromText(input.extractedText, source);
  } else {
    throw new Error('No existe contenido compatible para crear borrador');
  }
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO intake_drafts (
    id, organization_id, attachment_id, source_type, draft_json, status
  ) VALUES (?, ?, ?, ?, ?, 'REVIEW_PENDING')
  ON CONFLICT(attachment_id) DO UPDATE SET
    draft_json = excluded.draft_json,
    source_type = excluded.source_type,
    status = 'REVIEW_PENDING',
    updated_at = datetime('now')`,
  )
    .bind(id, input.organizationId, input.attachmentId, draft.source, JSON.stringify(draft))
    .run();
  return { id, draft };
}
