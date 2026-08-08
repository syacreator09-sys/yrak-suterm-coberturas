import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppBindings } from '../env.js';
import { requireRoles } from '../middleware.js';
import { validateEvidence, sha256Hex } from '@yrak/storage';

export const attachmentRoutes = new Hono<AppBindings>();

function safeKeySegment(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 160);
  return sanitized || '_';
}

attachmentRoutes.post('/', requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'OPERATOR'), zValidator('query', z.object({
  entityType: z.string().min(1).max(80),
  entityId: z.string().min(1).max(200),
})), async (c) => {
  if (!c.env.EVIDENCE_BUCKET) return c.json({ error: 'EVIDENCE_BUCKET_NOT_CONFIGURED' }, 503);
  const form = await c.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return c.json({ error: 'FILE_REQUIRED' }, 400);

  validateEvidence({ mimeType: file.type, byteSize: file.size });
  const bytes = await file.arrayBuffer();
  const hash = await sha256Hex(bytes);
  const user = c.get('user');
  const query = c.req.valid('query');
  const id = crypto.randomUUID();
  const key = `${safeKeySegment(user.organizationId)}/${safeKeySegment(query.entityType)}/${safeKeySegment(query.entityId)}/${id}-${safeKeySegment(file.name)}`;

  await c.env.EVIDENCE_BUCKET.put(key, bytes, {
    httpMetadata: { contentType: file.type },
    customMetadata: { sha256: hash },
  });
  await c.env.DB.prepare(`INSERT INTO attachments(id,organization_id,entity_type,entity_id,original_filename,mime_type,byte_size,sha256,r2_key,uploaded_by)
    VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, user.organizationId, query.entityType, query.entityId, file.name, file.type, file.size, hash, key, user.id).run();
  return c.json({ id, filename: file.name, mimeType: file.type, byteSize: file.size, sha256: hash }, 201);
});
