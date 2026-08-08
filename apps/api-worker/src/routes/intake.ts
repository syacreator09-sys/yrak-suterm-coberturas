import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppBindings } from '../env.js';
import { assertGroupAccess, requireRoles } from '../middleware.js';
import { IntakeAgent, IntakeDraftSchema } from '@yrak/agents';
import { AuditWriter } from '@yrak/audit';
import { createAIProvider } from '../services/ai-service.js';
import { createCoverageCase } from '../services/coverage-service.js';

export const intakeRoutes = new Hono<AppBindings>();
const intakeRoles = requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'OPERATOR');
const MAX_INTAKE_TEXT_CHARS = 100_000;
const draftSchema = z.object({
  sourceType: z.enum(['TEXT', 'EMAIL', 'AUDIO', 'IMAGE', 'PDF', 'SPREADSHEET']),
  sourceAttachmentId: z.string().nullable().optional(),
  extracted: IntakeDraftSchema,
  confidence: z.number().min(0).max(1).nullable().optional(),
});

function canAccessAnyDraft(role: string): boolean {
  return role === 'ADMIN' || role === 'HR';
}

async function persist(c: Context<AppBindings>, input: z.infer<typeof draftSchema>) {
  const user = c.get('user'), id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO intake_drafts(id,organization_id,source_type,source_attachment_id,extracted_json,confidence,status,created_by)
    VALUES(?,?,?,?,?,?,'PENDING_REVIEW',?)`)
    .bind(id, user.organizationId, input.sourceType, input.sourceAttachmentId ?? null, JSON.stringify(input.extracted), input.confidence ?? null, user.id).run();
  await new AuditWriter(c.env.DB).append({
    organizationId: user.organizationId,
    actorId: user.id,
    actorRole: user.role,
    entityType: 'INTAKE_DRAFT',
    entityId: id,
    action: 'CREATED',
    newValue: {
      sourceType: input.sourceType,
      sourceAttachmentId: input.sourceAttachmentId ?? null,
      confidence: input.confidence ?? null,
      status: 'PENDING_REVIEW',
      extractedPayloadStoredOutsideAudit: true,
    },
    correlationId: c.get('correlationId'),
  });
  return { id, status: 'PENDING_REVIEW', extracted: input.extracted };
}

intakeRoutes.post('/drafts', intakeRoles, zValidator('json', draftSchema), async (c) =>
  c.json(await persist(c, c.req.valid('json')), 201));

intakeRoutes.post('/extract-text', intakeRoles, zValidator('json', z.object({ content: z.string().min(1).max(MAX_INTAKE_TEXT_CHARS) })), async (c) => {
  const extracted = await new IntakeAgent(createAIProvider(c.env)).extractFromText(c.req.valid('json').content);
  return c.json(await persist(c, { sourceType: 'TEXT', extracted }), 201);
});

intakeRoutes.post('/attachments/:attachmentId/process', intakeRoles, async (c) => {
  const user = c.get('user');
  if (!c.env.EVIDENCE_BUCKET) return c.json({ error: 'EVIDENCE_BUCKET_NOT_CONFIGURED' }, 503);
  const row = await c.env.DB.prepare(`SELECT id,original_filename,mime_type,r2_key,uploaded_by
    FROM attachments WHERE id=? AND organization_id=? AND entity_type='INTAKE'`)
    .bind(c.req.param('attachmentId'), user.organizationId)
    .first<{ id: string; original_filename: string; mime_type: string; r2_key: string; uploaded_by: string }>();
  if (!row) return c.json({ error: 'ATTACHMENT_NOT_FOUND' }, 404);
  if (!canAccessAnyDraft(user.role) && row.uploaded_by !== user.id) return c.json({ error: 'ATTACHMENT_FORBIDDEN' }, 403);

  const object = await c.env.EVIDENCE_BUCKET.get(row.r2_key);
  if (!object) return c.json({ error: 'ATTACHMENT_OBJECT_NOT_FOUND' }, 404);
  const bytes = await object.arrayBuffer();
  let content: string;
  let sourceType: 'AUDIO' | 'IMAGE' | 'PDF' | 'SPREADSHEET';
  const provider = createAIProvider(c.env);

  if (row.mime_type.startsWith('audio/')) {
    content = (await provider.transcribe({ bytes, mimeType: row.mime_type, language: 'es' })).text;
    sourceType = 'AUDIO';
  } else if (row.mime_type === 'text/csv') {
    content = new TextDecoder().decode(bytes);
    sourceType = 'SPREADSHEET';
  } else {
    if (!c.env.AI) return c.json({ error: 'WORKERS_AI_MARKDOWN_CONVERTER_NOT_CONFIGURED' }, 503);
    const converter = c.env.AI as unknown as { toMarkdown(input: { name: string; blob: Blob }): Promise<{ format: string; data?: string; error?: string }> };
    const converted = await converter.toMarkdown({ name: row.original_filename, blob: new Blob([bytes], { type: row.mime_type }) });
    if (converted.format === 'error' || !converted.data) throw new Error(converted.error ?? 'DOCUMENT_CONVERSION_FAILED');
    content = converted.data;
    sourceType = row.mime_type === 'application/pdf' ? 'PDF' : row.mime_type.startsWith('image/') ? 'IMAGE' : 'SPREADSHEET';
  }

  if (content.length > MAX_INTAKE_TEXT_CHARS) return c.json({ error: 'EXTRACTED_TEXT_TOO_LARGE' }, 413);
  const extracted = await new IntakeAgent(provider).extractFromText(content);
  await c.env.DB.prepare(`UPDATE attachments SET extraction_status='EXTRACTED',extracted_text=?,extraction_confidence=? WHERE id=?`)
    .bind(content, null, row.id).run();
  await new AuditWriter(c.env.DB).append({
    organizationId: user.organizationId,
    actorId: user.id,
    actorRole: user.role,
    entityType: 'ATTACHMENT',
    entityId: row.id,
    action: 'EXTRACTED',
    newValue: { sourceType, mimeType: row.mime_type, extractedChars: content.length, rawExtractedTextStoredOutsideAudit: true },
    correlationId: c.get('correlationId'),
  });
  return c.json(await persist(c, { sourceType, sourceAttachmentId: row.id, extracted }), 201);
});

intakeRoutes.get('/drafts', intakeRoles, async (c) => {
  const user = c.get('user');
  const rows = canAccessAnyDraft(user.role)
    ? await c.env.DB.prepare(`SELECT id,source_type,source_attachment_id,confidence,status,created_by,created_at
        FROM intake_drafts WHERE organization_id=? ORDER BY created_at DESC LIMIT 100`)
        .bind(user.organizationId).all()
    : await c.env.DB.prepare(`SELECT id,source_type,source_attachment_id,confidence,status,created_by,created_at
        FROM intake_drafts WHERE organization_id=? AND created_by=? ORDER BY created_at DESC LIMIT 100`)
        .bind(user.organizationId, user.id).all();
  return c.json({ items: rows.results ?? [] });
});

intakeRoutes.get('/drafts/:draftId', intakeRoles, async (c) => {
  const user = c.get('user');
  const draft = await c.env.DB.prepare(`SELECT id,source_type,source_attachment_id,extracted_json,confidence,status,created_by,created_at,reviewed_by,reviewed_at
    FROM intake_drafts WHERE id=? AND organization_id=?`)
    .bind(c.req.param('draftId'), user.organizationId).first<Record<string, unknown>>();
  if (!draft) return c.json({ error: 'INTAKE_DRAFT_NOT_FOUND' }, 404);
  if (!canAccessAnyDraft(user.role) && draft.created_by !== user.id) return c.json({ error: 'INTAKE_DRAFT_FORBIDDEN' }, 403);
  const { extracted_json: extractedJson, ...metadata } = draft;
  let extracted: unknown = null;
  try {
    extracted = JSON.parse(String(extractedJson ?? '{}'));
  } catch {
    return c.json({ error: 'INTAKE_DRAFT_CORRUPT' }, 500);
  }
  return c.json({ ...metadata, extracted });
});

intakeRoutes.post('/drafts/:draftId/consume', intakeRoles, zValidator('json', z.object({
  groupId: z.string(),
  targetLevelId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().nullable().optional(),
})), async (c) => {
  const user = c.get('user'), input = c.req.valid('json');
  await assertGroupAccess(c, input.groupId);
  const draft = await c.env.DB.prepare(`SELECT id,status,created_by FROM intake_drafts WHERE id=? AND organization_id=?`)
    .bind(c.req.param('draftId'), user.organizationId).first<{ id: string; status: string; created_by: string }>();
  if (!draft) return c.json({ error: 'INTAKE_DRAFT_NOT_FOUND' }, 404);
  if (!canAccessAnyDraft(user.role) && draft.created_by !== user.id) return c.json({ error: 'INTAKE_DRAFT_FORBIDDEN' }, 403);
  if (draft.status !== 'PENDING_REVIEW') {
    const existing = await c.env.DB.prepare(`SELECT id,effective_days,process_type,status FROM coverage_cases
      WHERE source_intake_draft_id=? AND organization_id=?`).bind(draft.id, user.organizationId).first();
    if (existing) return c.json({ coverage: existing, idempotent: true });
    return c.json({ error: 'INTAKE_DRAFT_NOT_PENDING_REVIEW' }, 409);
  }
  const existing = await c.env.DB.prepare(`SELECT id,effective_days,process_type,status FROM coverage_cases
    WHERE source_intake_draft_id=? AND organization_id=?`).bind(draft.id, user.organizationId).first<{ id: string }>();
  if (existing) return c.json({ coverage: existing, idempotent: true });
  const coverage = await createCoverageCase(c.env, user, c.get('correlationId'), { ...input, sourceIntakeDraftId: draft.id });
  const consumed = await c.env.DB.prepare(`UPDATE intake_drafts SET status='CONSUMED',reviewed_by=?,reviewed_at=datetime('now')
    WHERE id=? AND status='PENDING_REVIEW'`).bind(user.id, draft.id).run();
  if ((consumed.meta.changes ?? 0) !== 1) {
    console.error('INTAKE_DRAFT_CONSUME_RACE', draft.id);
    return c.json({ error: 'INTAKE_DRAFT_CONSUME_CONFLICT' }, 409);
  }
  await new AuditWriter(c.env.DB).append({
    organizationId: user.organizationId,
    actorId: user.id,
    actorRole: user.role,
    entityType: 'INTAKE_DRAFT',
    entityId: draft.id,
    action: 'CONSUMED',
    previousValue: { status: draft.status },
    newValue: { status: 'CONSUMED', coverageCaseId: coverage.id, groupId: input.groupId, targetLevelId: input.targetLevelId },
    correlationId: c.get('correlationId'),
  });
  return c.json({ coverage }, 201);
});
