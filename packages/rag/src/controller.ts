import type { RagReranker, RagRetriever } from './ports.js';
import type { RagAccessContext, RagCitation, RagQuery, RagRetrievalFilter, RagRetrievalResult, RetrievedChunk } from './types.js';

export class RagAuthorizationBoundaryError extends Error {
  constructor(message = 'RAG_AUTHORIZATION_BOUNDARY_VIOLATION') {
    super(message);
    this.name = 'RagAuthorizationBoundaryError';
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

export class RagController {
  constructor(
    private readonly retriever: RagRetriever,
    private readonly reranker?: RagReranker,
  ) {}

  async retrieve(query: RagQuery, access: RagAccessContext): Promise<RagRetrievalResult> {
    const text = query.text.trim();
    if (!text) throw new Error('RAG_QUERY_REQUIRED');
    const requestedTopK = query.topK ?? 8;
    const topK = Math.max(1, Math.min(20, requestedTopK));
    const candidates = await this.retriever.retrieve({ text, topK }, filterFor(access));

    for (const chunk of candidates) assertChunkAuthorized(chunk, access);

    const ranked = this.reranker
      ? await this.reranker.rerank(text, candidates, topK)
      : [...candidates].sort((a, b) => b.score - a.score).slice(0, topK);

    for (const chunk of ranked) assertChunkAuthorized(chunk, access);
    const chunks = ranked.slice(0, topK);
    return { chunks, citations: chunks.map(citationFor) };
  }
}
