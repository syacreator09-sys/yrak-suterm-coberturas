import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { AuditWriter } from '@yrak/audit';
import { RagAdapterHttpError, RagAuthorizationBoundaryError } from '@yrak/rag';
import type { AppBindings } from '../env.js';
import { hasOrganizationWideRead, requireRoles } from '../middleware.js';
import { createRagController, RagConfigurationError } from '../services/rag-service.js';

export const ragRoutes = new Hono<AppBindings>();

const querySchema = z.object({
  query: z.string().trim().min(2).max(2_000),
  topK: z.number().int().min(1).max(20).default(8),
});

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function accessContext(c: Parameters<Parameters<typeof ragRoutes.post>[1]>[0]) {
  const user = c.get('user');
  const organizationWide = hasOrganizationWideRead(user.role);
  if (organizationWide) {
    return { organizationId: user.organizationId, allowedGroupIds: [] as string[], organizationWide: true };
  }
  const rows = await c.env.DB.prepare(`SELECT g.id
      FROM user_groups ug
      JOIN groups g ON g.id=ug.group_id
      WHERE ug.user_id=? AND g.organization_id=? AND g.active=1
      ORDER BY g.id`)
    .bind(user.id, user.organizationId)
    .all<{ id: string }>();
  return {
    organizationId: user.organizationId,
    allowedGroupIds: (rows.results ?? []).map((row) => row.id),
    organizationWide: false,
  };
}

ragRoutes.post(
  '/search',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'AUDITOR', 'OPERATOR'),
  zValidator('json', querySchema),
  async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');
    const access = await accessContext(c);
    const started = Date.now();
    try {
      const result = await createRagController(c.env).retrieve({ text: input.query, topK: input.topK }, access);
      const querySha256 = await sha256Hex(input.query);
      const documentIds = [...new Set(result.citations.map((citation) => citation.documentId))].slice(0, 20);
      await new AuditWriter(c.env.DB).append({
        organizationId: user.organizationId,
        actorId: user.id,
        actorRole: user.role,
        entityType: 'RAG_QUERY',
        entityId: c.get('correlationId'),
        action: 'RAG_RETRIEVAL',
        newValue: {
          querySha256,
          topK: input.topK,
          resultCount: result.chunks.length,
          documentIds,
          organizationWide: access.organizationWide,
          groupScopeCount: access.allowedGroupIds.length,
          latencyMs: Date.now() - started,
        },
        correlationId: c.get('correlationId'),
      });
      return c.json({ items: result.chunks, citations: result.citations });
    } catch (error) {
      if (error instanceof RagConfigurationError) return c.json({ error: 'RAG_NOT_CONFIGURED' }, 503);
      if (error instanceof RagAuthorizationBoundaryError) {
        console.error('RAG_AUTHORIZATION_BOUNDARY_VIOLATION');
        return c.json({ error: 'RAG_RETRIEVAL_BLOCKED' }, 502);
      }
      if (error instanceof RagAdapterHttpError || (error instanceof DOMException && error.name === 'AbortError')) {
        console.error('RAG_UPSTREAM_UNAVAILABLE', error instanceof Error ? error.name : 'UNKNOWN_ERROR');
        return c.json({ error: 'RAG_RETRIEVAL_UNAVAILABLE' }, 503);
      }
      throw error;
    }
  },
);
