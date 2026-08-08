export interface RagAccessContext {
  organizationId: string;
  allowedGroupIds: readonly string[];
  organizationWide: boolean;
}

export interface RagQuery {
  text: string;
  topK?: number;
}

export interface RagRetrievalFilter {
  organizationId: string;
  allowedGroupIds: readonly string[];
  organizationWide: boolean;
  activeOnly: true;
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  organizationId: string;
  groupId?: string | null;
  text: string;
  score: number;
  page?: number | null;
  section?: string | null;
  documentVersion?: string | null;
  source?: string | null;
  status?: string | null;
}

export interface RagCitation {
  documentId: string;
  chunkId: string;
  page?: number | null;
  section?: string | null;
  documentVersion?: string | null;
  source?: string | null;
}

export interface RagRetrievalResult {
  chunks: RetrievedChunk[];
  citations: RagCitation[];
}
