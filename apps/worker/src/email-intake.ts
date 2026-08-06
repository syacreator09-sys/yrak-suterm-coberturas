import PostalMime from 'postal-mime';
import type { Attachment } from 'postal-mime';
import { getGenerativeProvider } from './ai.js';
import { createIntakeDraft } from './intake.js';
import type { AttachmentProcessingMessage, Env } from './types.js';

const processableMimeTypes = new Set([
  'audio/ogg',
  'audio/opus',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function attachmentBytes(attachment: Attachment): ArrayBuffer {
  if (attachment.content instanceof ArrayBuffer) return attachment.content;
  const view = attachment.content as Uint8Array;
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
}

export async function processInboundEmail(
  message: ForwardableEmailMessage,
  env: Env,
): Promise<void> {
  const channel = await env.DB.prepare(`SELECT organization_id
    FROM organization_email_channels WHERE inbound_address = ? AND active = 1`)
    .bind(message.to.toLowerCase())
    .first<{ organization_id: string }>();
  if (!channel) {
    message.setReject('Dirección de entrada no configurada');
    return;
  }

  const rawBytes = await new Response(message.raw).arrayBuffer();
  const parsed = await PostalMime.parse(rawBytes);
  const emailId = crypto.randomUUID();
  const base = `${channel.organization_id}/inbound-email/${new Date().toISOString().slice(0, 10)}/${emailId}`;
  const rawKey = `${base}.eml`;
  await env.EVIDENCE.put(rawKey, rawBytes, {
    httpMetadata: { contentType: 'message/rfc822' },
    customMetadata: { from: message.from, to: message.to },
  });
  await env.DB.prepare(`INSERT INTO messages (
    id, organization_id, channel, direction, recipient, subject, body_text, status
  ) VALUES (?, ?, 'EMAIL', 'INBOUND', ?, ?, ?, 'RECEIVED')`)
    .bind(
      emailId,
      channel.organization_id,
      message.to,
      parsed.subject ?? message.headers.get('subject') ?? null,
      (parsed.text ?? '').slice(0, 100_000),
    )
    .run();

  if (parsed.text?.trim()) {
    const bodyBytes = new TextEncoder().encode(parsed.text).buffer;
    const bodyAttachmentId = crypto.randomUUID();
    const bodyKey = `${base}-body.txt`;
    await env.EVIDENCE.put(bodyKey, bodyBytes, {
      httpMetadata: { contentType: 'text/plain; charset=utf-8' },
    });
    await env.DB.prepare(`INSERT INTO attachments (
      id, organization_id, entity_type, entity_id, original_filename, mime_type,
      byte_size, sha256, r2_key, extraction_status, extracted_text
    ) VALUES (?, ?, 'EMAIL', ?, 'email-body.txt', 'text/plain', ?, ?, ?, 'REVIEW_REQUIRED', ?)`)
      .bind(
        bodyAttachmentId,
        channel.organization_id,
        emailId,
        bodyBytes.byteLength,
        await sha256(bodyBytes),
        bodyKey,
        parsed.text,
      )
      .run();
    const provider = getGenerativeProvider(env);
    if (provider) {
      await createIntakeDraft(env, provider, {
        attachmentId: bodyAttachmentId,
        organizationId: channel.organization_id,
        mimeType: 'text/plain',
        extractedText: parsed.text,
        sourceOverride: 'EMAIL',
      });
    }
  }

  for (const attachment of parsed.attachments) {
    const mimeType = attachment.mimeType.toLowerCase();
    if (!processableMimeTypes.has(mimeType)) continue;
    const bytes = attachmentBytes(attachment);
    if (bytes.byteLength > 20 * 1024 * 1024) continue;
    const attachmentId = crypto.randomUUID();
    const filename = (attachment.filename || 'attachment').replaceAll(/[^a-zA-Z0-9._-]/g, '_');
    const r2Key = `${base}-${attachmentId}-${filename}`;
    await env.EVIDENCE.put(r2Key, bytes, { httpMetadata: { contentType: mimeType } });
    await env.DB.prepare(`INSERT INTO attachments (
      id, organization_id, entity_type, entity_id, original_filename, mime_type,
      byte_size, sha256, r2_key, extraction_status
    ) VALUES (?, ?, 'EMAIL', ?, ?, ?, ?, ?, ?, 'PENDING')`)
      .bind(
        attachmentId,
        channel.organization_id,
        emailId,
        filename,
        mimeType,
        bytes.byteLength,
        await sha256(bytes),
        r2Key,
      )
      .run();
    const queueMessage: AttachmentProcessingMessage = {
      kind: 'ATTACHMENT',
      attachmentId,
      r2Key,
      mimeType,
      organizationId: channel.organization_id,
    };
    await env.PROCESSING_QUEUE.send(queueMessage);
  }
}
