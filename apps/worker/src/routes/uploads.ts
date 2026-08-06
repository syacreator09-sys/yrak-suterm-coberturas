import { Hono } from 'hono';
import { authenticate, requireRoles } from '../auth.js';
import type { AppBindings, ProcessingMessage } from '../types.js';

const allowedMimeTypes = new Set([
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
const maximumBytes = 20 * 1024 * 1024;

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const uploadRoutes = new Hono<AppBindings>();
uploadRoutes.use('*', authenticate);

uploadRoutes.post('/attachments', requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'OPERATOR'), async (context) => {
  const body = await context.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return context.json({ error: 'FILE_REQUIRED' }, 400);
  if (!allowedMimeTypes.has(file.type)) return context.json({ error: 'UNSUPPORTED_MIME_TYPE' }, 415);
  if (file.size > maximumBytes) return context.json({ error: 'FILE_TOO_LARGE', maximumBytes }, 413);

  const user = context.get('user');
  const bytes = await file.arrayBuffer();
  const hash = await sha256(bytes);
  const attachmentId = crypto.randomUUID();
  const safeName = file.name.replaceAll(/[^a-zA-Z0-9._-]/g, '_');
  const r2Key = `${user.organizationId}/${new Date().toISOString().slice(0, 10)}/${attachmentId}-${safeName}`;

  await context.env.EVIDENCE.put(r2Key, bytes, {
    httpMetadata: { contentType: file.type },
    customMetadata: { sha256: hash, uploadedBy: user.id },
  });
  await context.env.DB.prepare(`INSERT INTO attachments (
    id, organization_id, entity_type, entity_id, original_filename, mime_type,
    byte_size, sha256, r2_key, extraction_status, uploaded_by
  ) VALUES (?, ?, 'INTAKE', ?, ?, ?, ?, ?, ?, 'PENDING', ?)`) 
    .bind(attachmentId, user.organizationId, attachmentId, file.name, file.type, file.size, hash, r2Key, user.id)
    .run();

  const message: ProcessingMessage = {
    attachmentId,
    r2Key,
    mimeType: file.type,
    organizationId: user.organizationId,
  };
  await context.env.PROCESSING_QUEUE.send(message);
  return context.json({ attachmentId, status: 'PENDING_REVIEW', sha256: hash }, 202);
});
