import type { EmbeddingProvider } from '../ports.js';

export interface OpenAICompatibleEmbeddingConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
  maxBatchSize?: number;
}

export class RagAdapterHttpError extends Error {
  constructor(
    public readonly adapter: string,
    public readonly status: number,
  ) {
    super(`${adapter.toUpperCase()}_HTTP_${status}`);
    this.name = 'RagAdapterHttpError';
  }
}

export function normalizeProviderBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('RAG_PROVIDER_BASE_URL_INVALID');
  }
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase());
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) {
    throw new Error('RAG_PROVIDER_BASE_URL_INVALID');
  }
  return url.toString().replace(/\/$/, '');
}

function parseEmbeddingResponse(body: unknown, expectedCount: number): number[][] {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { data?: unknown }).data)) {
    throw new Error('RAG_EMBEDDING_RESPONSE_INVALID');
  }
  const data = (body as { data: unknown[] }).data;
  const indexed = data.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new Error('RAG_EMBEDDING_RESPONSE_INVALID');
    const record = entry as { index?: unknown; embedding?: unknown };
    if (!Number.isInteger(record.index) || !Array.isArray(record.embedding)) throw new Error('RAG_EMBEDDING_RESPONSE_INVALID');
    const vector = record.embedding.map((value) => Number(value));
    if (!vector.length || vector.some((value) => !Number.isFinite(value))) throw new Error('RAG_EMBEDDING_RESPONSE_INVALID');
    return { index: Number(record.index), vector };
  }).sort((a, b) => a.index - b.index);

  if (indexed.length !== expectedCount || indexed.some((item, index) => item.index !== index)) {
    throw new Error('RAG_EMBEDDING_RESPONSE_COUNT_MISMATCH');
  }
  const dimensions = indexed[0]?.vector.length ?? 0;
  if (!dimensions || indexed.some((item) => item.vector.length !== dimensions)) {
    throw new Error('RAG_EMBEDDING_DIMENSION_MISMATCH');
  }
  return indexed.map((item) => item.vector);
}

export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxBatchSize: number;

  constructor(
    private readonly config: OpenAICompatibleEmbeddingConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = normalizeProviderBaseUrl(config.baseUrl);
    if (!config.model.trim()) throw new Error('RAG_EMBEDDING_MODEL_REQUIRED');
    this.timeoutMs = Math.max(1_000, Math.min(120_000, config.timeoutMs ?? 30_000));
    this.maxBatchSize = Math.max(1, Math.min(128, config.maxBatchSize ?? 32));
  }

  async embed(texts: readonly string[]): Promise<readonly number[][]> {
    if (!texts.length) return [];
    if (texts.length > this.maxBatchSize) throw new Error('RAG_EMBEDDING_BATCH_TOO_LARGE');
    const normalized = texts.map((text) => text.trim());
    if (normalized.some((text) => !text || text.length > 32_000)) throw new Error('RAG_EMBEDDING_TEXT_INVALID');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = new Headers({ 'content-type': 'application/json', accept: 'application/json' });
      if (this.config.apiKey?.trim()) headers.set('authorization', `Bearer ${this.config.apiKey.trim()}`);
      const response = await this.fetchImpl(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: this.config.model, input: normalized }),
        signal: controller.signal,
      });
      if (!response.ok) throw new RagAdapterHttpError('embedding_provider', response.status);
      return parseEmbeddingResponse(await response.json(), normalized.length);
    } finally {
      clearTimeout(timeout);
    }
  }
}
