import { describe, expect, it } from 'vitest';
import { normalizeProviderBaseUrl, OpenAICompatibleEmbeddingProvider } from './openai-compatible-embeddings.js';

describe('OpenAI-compatible embedding adapter', () => {
  it('allows HTTPS providers and local HTTP only', () => {
    expect(normalizeProviderBaseUrl('https://provider.example/v1/')).toBe('https://provider.example/v1');
    expect(normalizeProviderBaseUrl('http://127.0.0.1:11434/v1')).toBe('http://127.0.0.1:11434/v1');
    expect(() => normalizeProviderBaseUrl('http://provider.example/v1')).toThrow('RAG_PROVIDER_BASE_URL_INVALID');
  });

  it('sends a bounded embeddings request and restores index order', async () => {
    let seenUrl = '';
    let seenAuthorization = '';
    let seenBody: unknown;
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seenUrl = String(input);
      const headers = new Headers(init?.headers);
      seenAuthorization = headers.get('authorization') ?? '';
      seenBody = JSON.parse(String(init?.body));
      return Response.json({
        data: [
          { index: 1, embedding: [3, 4] },
          { index: 0, embedding: [1, 2] },
        ],
      });
    }) as typeof fetch;

    const provider = new OpenAICompatibleEmbeddingProvider({
      baseUrl: 'https://provider.example/v1',
      model: 'embedding-model',
      apiKey: 'test-secret',
    }, fetchImpl);

    await expect(provider.embed(['first', 'second'])).resolves.toEqual([[1, 2], [3, 4]]);
    expect(seenUrl).toBe('https://provider.example/v1/embeddings');
    expect(seenAuthorization).toBe('Bearer test-secret');
    expect(seenBody).toEqual({ model: 'embedding-model', input: ['first', 'second'] });
  });

  it('rejects inconsistent dimensions', async () => {
    const fetchImpl = (async () => Response.json({
      data: [
        { index: 0, embedding: [1, 2] },
        { index: 1, embedding: [3] },
      ],
    })) as typeof fetch;
    const provider = new OpenAICompatibleEmbeddingProvider({
      baseUrl: 'https://provider.example/v1',
      model: 'embedding-model',
    }, fetchImpl);
    await expect(provider.embed(['first', 'second'])).rejects.toThrow('RAG_EMBEDDING_DIMENSION_MISMATCH');
  });
});
