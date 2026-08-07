import { describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleProvider } from './openai-compatible-provider.js';

describe('OpenAICompatibleProvider', () => {
  it('works without an API key for local compatible endpoints', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'hello' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const provider = new OpenAICompatibleProvider({
      providerId: 'ollama-local',
      baseUrl: 'http://127.0.0.1:11434/v1',
      textModel: 'qwen3:8b',
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(provider.generate({ system: 's', prompt: 'p' })).resolves.toBe('hello');
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('http://127.0.0.1:11434/v1/chat/completions');
    expect((init?.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('sends a bearer token when one is configured', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer secret');
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
    });

    const provider = new OpenAICompatibleProvider({
      providerId: 'remote-test',
      baseUrl: 'https://example.test/v1',
      apiKey: 'secret',
      textModel: 'model',
      fetchImpl: fetchImpl as typeof fetch,
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
});
