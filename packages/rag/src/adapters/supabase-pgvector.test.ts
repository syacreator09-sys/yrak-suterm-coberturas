import { describe, expect, it } from 'vitest';
import type { EmbeddingProvider } from '../ports.js';
import { normalizeSupabaseUrl, SupabasePgvectorRetriever } from './supabase-pgvector.js';

const embeddings: EmbeddingProvider = {
  async embed() { return [[0.1, 0.2, 0.3]]; },
};

describe('Supabase pgvector retriever', () => {
  it('requires a clean HTTPS Supabase base URL', () => {
    expect(normalizeSupabaseUrl('https://project.supabase.co/')).toBe('https://project.supabase.co');
    expect(() => normalizeSupabaseUrl('http://project.supabase.co/')).toThrow('SUPABASE_URL_INVALID');
    expect(() => normalizeSupabaseUrl('https://project.supabase.co/path')).toThrow('SUPABASE_URL_INVALID');
  });

  it('passes organization/group scope inside the RPC body and maps citations fields', async () => {
    let seenUrl = '';
    let seenKey = '';
    let seenBody: Record<string, unknown> = {};
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seenUrl = String(input);
      seenKey = new Headers(init?.headers).get('apikey') ?? '';
      seenBody = JSON.parse(String(init?.body));
      return Response.json([{
        chunk_id: 'chunk-1',
        document_id: 'doc-1',
        organization_id: 'org-1',
        group_id: 'group-a',
        chunk_text: 'authorized text',
        similarity: 0.91,
        status: 'ACTIVE',
        page: 4,
        section: 'Eligibility',
        document_version: 'v3',
        source: 'r2://doc-1',
      }]);
    }) as typeof fetch;

    const retriever = new SupabasePgvectorRetriever({
      url: 'https://project.supabase.co',
      secretKey: 'server-secret',
    }, embeddings, fetchImpl);

    await expect(retriever.retrieve(
      { text: 'eligibility', topK: 5 },
      { organizationId: 'org-1', allowedGroupIds: ['group-a'], organizationWide: false, activeOnly: true },
    )).resolves.toEqual([{
      chunkId: 'chunk-1',
      documentId: 'doc-1',
      organizationId: 'org-1',
      groupId: 'group-a',
      text: 'authorized text',
      score: 0.91,
      status: 'ACTIVE',
      page: 4,
      section: 'Eligibility',
      documentVersion: 'v3',
      source: 'r2://doc-1',
    }]);

    expect(seenUrl).toBe('https://project.supabase.co/rest/v1/rpc/yrak_match_chunks');
    expect(seenKey).toBe('server-secret');
    expect(seenBody).toMatchObject({
      p_organization_id: 'org-1',
      p_allowed_group_ids: ['group-a'],
      p_organization_wide: false,
      p_active_only: true,
      p_match_count: 20,
      query_embedding: [0.1, 0.2, 0.3],
    });
  });

  it('fails closed before network access when a scoped caller has no groups', async () => {
    let calls = 0;
    const fetchImpl = (async () => { calls += 1; return Response.json([]); }) as typeof fetch;
    const retriever = new SupabasePgvectorRetriever({
      url: 'https://project.supabase.co',
      secretKey: 'server-secret',
    }, embeddings, fetchImpl);
    await expect(retriever.retrieve(
      { text: 'x' },
      { organizationId: 'org-1', allowedGroupIds: [], organizationWide: false, activeOnly: true },
    )).resolves.toEqual([]);
    expect(calls).toBe(0);
  });
});
