import { describe, expect, it } from 'vitest';
import { RagAuthorizationBoundaryError, RagController } from './controller.js';
import type { RagRetriever } from './ports.js';
import type { RagAccessContext, RetrievedChunk } from './types.js';

const access: RagAccessContext = {
  organizationId: 'org-1',
  allowedGroupIds: ['group-a'],
  organizationWide: false,
};

function retriever(chunks: RetrievedChunk[]): RagRetriever {
  return { async retrieve() { return chunks; } };
}

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    organizationId: 'org-1',
    groupId: 'group-a',
    text: 'policy text',
    score: 0.9,
    page: 3,
    section: 'Eligibility',
    documentVersion: 'v2',
    source: 'r2://doc-1',
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('RagController authorization boundary', () => {
  it('passes organization/group filters to the retriever and returns citations', async () => {
    let seenFilter: unknown;
    const source: RagRetriever = {
      async retrieve(_query, filter) {
        seenFilter = filter;
        return [chunk()];
      },
    };
    const result = await new RagController(source).retrieve({ text: ' eligibility ', topK: 8 }, access);
    expect(seenFilter).toEqual({ organizationId: 'org-1', allowedGroupIds: ['group-a'], organizationWide: false, activeOnly: true });
    expect(result.citations).toEqual([{
      documentId: 'doc-1', chunkId: 'chunk-1', page: 3, section: 'Eligibility', documentVersion: 'v2', source: 'r2://doc-1',
    }]);
  });

  it('fails closed when an adapter returns a cross-organization chunk', async () => {
    await expect(new RagController(retriever([chunk({ organizationId: 'org-2' })])).retrieve({ text: 'x' }, access))
      .rejects.toBeInstanceOf(RagAuthorizationBoundaryError);
  });

  it('fails closed when an adapter returns a group outside the caller scope', async () => {
    await expect(new RagController(retriever([chunk({ groupId: 'group-b' })])).retrieve({ text: 'x' }, access))
      .rejects.toBeInstanceOf(RagAuthorizationBoundaryError);
  });

  it('fails closed on groupless chunks for a group-scoped caller', async () => {
    await expect(new RagController(retriever([chunk({ groupId: null })])).retrieve({ text: 'x' }, access))
      .rejects.toBeInstanceOf(RagAuthorizationBoundaryError);
  });

  it('allows groupless organization documents only to organization-wide callers and clamps topK', async () => {
    const organizationWide: RagAccessContext = { ...access, organizationWide: true };
    const chunks = Array.from({ length: 25 }, (_, index) => chunk({ chunkId: `chunk-${index}`, groupId: null, score: 25 - index }));
    const result = await new RagController(retriever(chunks)).retrieve({ text: 'x', topK: 100 }, organizationWide);
    expect(result.chunks).toHaveLength(20);
  });
});
