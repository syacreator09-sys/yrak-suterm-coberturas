import type { RagReranker, RagRetriever } from './ports.js';
import type { RagAccessContext, RagCitation, RagQuery, RagRetrievalFilter, RagRetrievalResult, RetrievedChunk } from './types.js';

export class RagAuthorizationBoundaryError extends Error {
  constructor(message = 'RAG_AUTHORIZATION_BOUNDARY_VIOLATION') {
    super(message);
    this.name = 'RagAuthorizationBoundaryError';
  }
}

export class RagRerankerBoundaryError extends Error {
  constructor(message = 'RAG_RERANKER_BOUNDARY_VIOLATION') {
    super(message);
    this.name = 'RagRerankerBoundaryError';
  }
}

function filterFor(access: RagAccessContext): RagRetrievalFilter {
  return {
    organizationId: access.organizationId,
    allowedGroupIds: [...new Set(access.allowedGroupIds)],
    organizationWide: access.organizationWide,
    activeOnly: true,
  };
}

export function assertChunkAuthorized(chunk: RetrievedChunk, access: RagAccessContext): void {
  if (chunk.organizationId !== access.organizationId) throw new RagAuthorizationBoundaryError();
  if (chunk.status.toUpperCase() !== 'ACTIVE') throw new RagAuthorizationBoundaryError();
  if (!access.organizationWide) {
    if (!chunk.groupId || !access.allowedGroupIds.includes(chunk.groupId)) throw new RagAuthorizationBoundaryError();
  }
}

function citationFor(chunk: RetrievedChunk): RagCitation {
  return {
    documentId: chunk.documentId,
    chunkId: chunk.chunkId,
    ...(chunk.page !== undefined ? { page: chunk.page } : {}),
    ...(chunk.section !== undefined ? { section: chunk.section } : {}),
    ...(chunk.documentVersion !== undefined ? { documentVersion: chunk.documentVersion } : {}),
    ...(chunk.source !== undefined ? { source: chunk.source } : {}),
  };
}

function safeTopK(value: number | undefined): number {
  if (value === undefined) return 8;
  if (!Number.isFinite(value)) return 8;
  return Math.max(1, Math.min(20, Math.trunc(value)));
}

function canonicalizeReranked(
  candidates: readonly RetrievedChunk[],
  reranked: readonly RetrievedChunk[],
): RetrievedChunk[] {
  const byId = new Map(candidates.map((chunk) => [chunk.chunkId, chunk]));
  const seen = new Set<string>();
  const output: RetrievedChunk[] = [];
  for (const item of reranked) {
    const canonical = byId.get(item.chunkId);
    if (!canonical) throw new RagRerankerBoundaryError();
    if (seen.has(item.chunkId)) continue;
    seen.add(item.chunkId);
    output.push(canonical);
  }
  return output;
}

export class RagController {
  constructor(
    private readonly retriever: RagRetriever,
    private readonly reranker?: RagReranker,
  ) {}

  async retrieve(query: RagQuery, access: RagAccessContext): Promise<RagRetrievalResult> {
    const text = query.text.trim();
    if (!text) throw new Error('RAG_QUERY_REQUIRED');
    const topK = safeTopK(query.topK);
    const candidates = await this.retriever.retrieve({ text, topK }, filterFor(access));

    for (const chunk of candidates) assertChunkAuthorized(chunk, access);

    const ranked = this.reranker
      ? canonicalizeReranked(candidates, await this.reranker.rerank(text, candidates, topK))
      : [...candidates].sort((a, b) => b.score - a.score);

    for (const chunk of ranked) assertChunkAuthorized(chunk, access);
    const chunks = ranked.slice(0, topK);
    return { chunks, citations: chunks.map(citationFor) };
  }
}
