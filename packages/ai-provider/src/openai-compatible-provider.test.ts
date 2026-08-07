import { describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleProvider } from './openai-compatible-provider.js';

describe('OpenAICompatibleProvider', () => {
  it('works without an API key for local compatible endpoints', async () => {
    let seenUrl = '';
    let seenHeaders: Record<string, string> = {};
    const fetchImpl: typeof fetch = async (url, init) => {
      seenUrl = String(url);
      seenHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify({ choices: [{ message: { content: 'hello' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const provider = new OpenAICompatibleProvider({
      providerId: 'ollama-local',
      baseUrl: 'http://127.0.0.1:11434/v1',
      textModel: 'qwen3:8b',
      fetchImpl,
    });

    await expect(provider.generate({ system: 's', prompt: 'p' })).resolves.toBe('hello');
    expect(seenUrl).toBe('http://127.0.0.1:11434/v1/chat/completions');
    expect(seenHeaders.authorization).toBeUndefined();
  });

  it('sends a bearer token when one is configured', async () => {
    const fetchImpl: typeof fetch = async (_url, init) => {
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer secret');
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
    };

    const provider = new OpenAICompatibleProvider({
      providerId: 'remote-test',
      baseUrl: 'https://example.test/v1',
      apiKey: 'secret',
      textModel: 'model',
      fetchImpl,
    });

    await expect(provider.generate({ system: 's', prompt: 'p' })).resolves.toBe('ok');
  });

  it('exposes HTTP status for retry classification', async () => {
    const provider = new OpenAICompatibleProvider({
      providerId: 'nvidia-test',
      baseUrl: 'https://example.test/v1',
      textModel: 'model',
      fetchImpl: (async () => new Response(JSON.stringify({ error: { message: 'busy' } }), { status: 429 })) as typeof fetch,
    });

    await expect(provider.generate({ system: 's', prompt: 'p' })).rejects.toMatchObject({ status: 429, providerId: 'nvidia-test' });
  });

  it('preserves retryable status even when upstream error body is not JSON', async () => {
    const provider = new OpenAICompatibleProvider({
      providerId: 'generic-remote',
      baseUrl: 'https://example.test/v1',
      textModel: 'model',
      fetchImpl: (async () => new Response('<html>bad gateway</html>', { status: 503 })) as typeof fetch,
    });

    await expect(provider.generate({ system: 's', prompt: 'p' })).rejects.toMatchObject({ status: 503, providerId: 'generic-remote' });
  });
});
