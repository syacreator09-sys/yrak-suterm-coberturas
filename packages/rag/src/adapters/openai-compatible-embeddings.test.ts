import { describe, expect, it } from 'vitest';
import { normalizeProviderBaseUrl, OpenAICompatibleEmbeddingProvider } from './openai-compatible-embeddings.js';

describe('OpenAI-compatible embedding adapter', () => {
  it('allows HTTPS providers and local HTTP only', () => {
    expect(normalizeProviderBaseUrl('https://provider.example/v1/')).toBe('https://provider.example/v1');
    expect(normalizeProviderBaseUrl('http://127.0.0.1:11434/v1')).toBe('http://127.0.0.1:11434/v1');
    expect(() => normalizeProviderBaseUrl('http://provider.example/v1')).toThrow('RAG_PROVIDER_BASE_URL_INVALID');
    expect(() => normalizeProviderBaseUrl('https://user:pass@provider.example/v1')).toThrow('RAG_PROVIDER_BASE_URL_INVALID');
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

  it('does not send an authorization header when no key is configured', async () => {
    let authorization: string | null = 'unexpected';
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      authorization = new Headers(init?.headers).get('authorization');
      return Response.json({ data: [{ index: 0, embedding: [1, 2] }] });
    }) as typeof fetch;
    const provider = new OpenAICompatibleEmbeddingProvider({ baseUrl: 'http://127.0.0.1:11434/v1', model: 'local-embed' }, fetchImpl);
    await provider.embed(['hello']);
    expect(authorization).toBeNull();
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

  it('rejects missing or duplicate index coverage', async () => {
    const fetchImpl = (async () => Response.json({
      data: [
        { index: 0, embedding: [1, 2] },
        { index: 0, embedding: [3, 4] },
      ],
    })) as typeof fetch;
    const provider = new OpenAICompatibleEmbeddingProvider({ baseUrl: 'https://provider.example/v1', model: 'embedding-model' }, fetchImpl);
    await expect(provider.embed(['first', 'second'])).rejects.toThrow('RAG_EMBEDDING_RESPONSE_COUNT_MISMATCH');
  });

  it('rejects empty, oversized and over-batch input before network access', async () => {
    let calls = 0;
    const fetchImpl = (async () => { calls += 1; return Response.json({ data: [] }); }) as typeof fetch;
    const provider = new OpenAICompatibleEmbeddingProvider({ baseUrl: 'https://provider.example/v1', model: 'embedding-model', maxBatchSize: 2 }, fetchImpl);
    await expect(provider.embed(['   '])).rejects.toThrow('RAG_EMBEDDING_TEXT_INVALID');
    await expect(provider.embed(['x'.repeat(32_001)])).rejects.toThrow('RAG_EMBEDDING_TEXT_INVALID');
    await expect(provider.embed(['a', 'b', 'c'])).rejects.toThrow('RAG_EMBEDDING_BATCH_TOO_LARGE');
    expect(calls).toBe(0);
  });

  it('surfaces provider HTTP failure without returning upstream response text', async () => {
    const fetchImpl = (async () => new Response('sensitive upstream detail', { status: 503 })) as typeof fetch;
    const provider = new OpenAICompatibleEmbeddingProvider({ baseUrl: 'https://provider.example/v1', model: 'embedding-model' }, fetchImpl);
    await expect(provider.embed(['hello'])).rejects.toMatchObject({ name: 'RagAdapterHttpError', adapter: 'embedding_provider', status: 503 });
  });
});
