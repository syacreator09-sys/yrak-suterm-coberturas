import type { RagQuery, RagRetrievalFilter, RetrievedChunk } from './types.js';

export interface RagRetriever {
  retrieve(query: RagQuery, filter: RagRetrievalFilter): Promise<RetrievedChunk[]>;
}

export interface RagReranker {
  rerank(query: string, chunks: readonly RetrievedChunk[], limit: number): Promise<RetrievedChunk[]>;
}

export interface RagDocumentStore {
  getDocumentMetadata(documentId: string, organizationId: string): Promise<Record<string, unknown> | null>;
}

export interface EmbeddingProvider {
  embed(texts: readonly string[]): Promise<readonly number[][]>;
}
