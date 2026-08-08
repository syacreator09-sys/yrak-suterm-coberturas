import type { EmbeddingProvider, RagRetriever } from '../ports.js';
import type { RagQuery, RagRetrievalFilter, RetrievedChunk } from '../types.js';
import { RagAdapterHttpError } from './openai-compatible-embeddings.js';

export interface SupabasePgvectorConfig {
  url: string;
  secretKey: string;
  rpcName?: string;
  timeoutMs?: number;
  candidateMultiplier?: number;
}

interface RpcRow {
  chunk_id: string;
  document_id: string;
  organization_id: string;
  group_id: string | null;
  chunk_text: string;
  similarity: number;
  status: string;
  page: number | null;
  section: string | null;
  document_version: string | null;
  source: string | null;
}

export function normalizeSupabaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('SUPABASE_URL_INVALID');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('SUPABASE_URL_INVALID');
  }
  return url.origin;
}

function parseRows(body: unknown): RpcRow[] {
  if (!Array.isArray(body)) throw new Error('SUPABASE_RAG_RESPONSE_INVALID');
  return body.map((value) => {
    if (!value || typeof value !== 'object') throw new Error('SUPABASE_RAG_RESPONSE_INVALID');
    const row = value as Partial<RpcRow>;
    if (
      typeof row.chunk_id !== 'string' ||
      typeof row.document_id !== 'string' ||
      typeof row.organization_id !== 'string' ||
      typeof row.chunk_text !== 'string' ||
      typeof row.status !== 'string' ||
      typeof row.similarity !== 'number' ||
      !Number.isFinite(row.similarity)
    ) {
      throw new Error('SUPABASE_RAG_RESPONSE_INVALID');
    }
    return {
      chunk_id: row.chunk_id,
      document_id: row.document_id,
      organization_id: row.organization_id,
      group_id: typeof row.group_id === 'string' ? row.group_id : null,
      chunk_text: row.chunk_text,
      similarity: row.similarity,
      status: row.status,
      page: typeof row.page === 'number' ? row.page : null,
      section: typeof row.section === 'string' ? row.section : null,
      document_version: typeof row.document_version === 'string' ? row.document_version : null,
      source: typeof row.source === 'string' ? row.source : null,
    };
  });
}

export class SupabasePgvectorRetriever implements RagRetriever {
  private readonly baseUrl: string;
  private readonly rpcName: string;
  private readonly timeoutMs: number;
  private readonly candidateMultiplier: number;

  constructor(
    private readonly config: SupabasePgvectorConfig,
    private readonly embeddings: EmbeddingProvider,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = normalizeSupabaseUrl(config.url);
    if (!config.secretKey.trim()) throw new Error('SUPABASE_SECRET_KEY_REQUIRED');
    this.rpcName = config.rpcName?.trim() || 'yrak_match_chunks';
    if (!/^[a-zA-Z0-9_]+$/.test(this.rpcName)) throw new Error('SUPABASE_RAG_RPC_INVALID');
    this.timeoutMs = Math.max(1_000, Math.min(120_000, config.timeoutMs ?? 30_000));
    this.candidateMultiplier = Math.max(1, Math.min(8, config.candidateMultiplier ?? 4));
  }

  async retrieve(query: RagQuery, filter: RagRetrievalFilter): Promise<RetrievedChunk[]> {
    if (!filter.organizationWide && filter.allowedGroupIds.length === 0) return [];
    const [embedding] = await this.embeddings.embed([query.text]);
    if (!embedding) throw new Error('RAG_EMBEDDING_MISSING');

    const requestedTopK = Math.max(1, Math.min(20, query.topK ?? 8));
    const matchCount = Math.min(80, requestedTopK * this.candidateMultiplier);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/rest/v1/rpc/${this.rpcName}`, {
        method: 'POST',
        headers: {
          apikey: this.config.secretKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          query_embedding: embedding,
          p_organization_id: filter.organizationId,
          p_allowed_group_ids: filter.organizationWide ? null : [...filter.allowedGroupIds],
          p_organization_wide: filter.organizationWide,
          p_active_only: filter.activeOnly,
          p_match_count: matchCount,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new RagAdapterHttpError('supabase_rag', response.status);
      return parseRows(await response.json()).map((row) => ({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        organizationId: row.organization_id,
        groupId: row.group_id,
        text: row.chunk_text,
        score: row.similarity,
        status: row.status,
        page: row.page,
        section: row.section,
        documentVersion: row.document_version,
        source: row.source,
      }));
    } finally {
      clearTimeout(timeout);
    }
  }
}
