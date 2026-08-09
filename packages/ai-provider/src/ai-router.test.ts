import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import type { AIProvider } from './provider.js';
import { AIProviderRegistry } from './provider-registry.js';
import { YrakAIRouter } from './ai-router.js';

function provider(value: string): AIProvider {
  return {
    async generate() { return value; },
    async extract<T>(_input: { system: string; content: string }, schema: z.ZodType<T>) { return schema.parse({}) as T; },
    async transcribe() { return { text: value }; },
  };
}

describe('YrakAIRouter', () => {
  it('uses a fallback after a retryable provider failure', async () => {
    const primary = provider('unused');
    primary.generate = async () => { throw Object.assign(new Error('rate limited'), { status: 429 }); };

    const registry = new AIProviderRegistry()
      .register({ id: 'primary', provider: primary, capabilities: ['generate', 'extract'] })
      .register({ id: 'fallback', provider: provider('fallback'), capabilities: ['generate', 'extract'] });

    const router = new YrakAIRouter(registry, {
      development: { SUPPORT_RESPONSE: ['primary', 'fallback'] },
    });

    const result = await router.generate('development', 'SUPPORT_RESPONSE', { system: 's', prompt: 'p' });
    expect(result.value).toBe('fallback');
    expect(result.provider).toBe('fallback');
    expect(result.fallbackUsed).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it('deduplicates providers and never exceeds max attempts', async () => {
    let calls = 0;
    const bad = provider('unused');
    bad.generate = async () => { calls += 1; throw Object.assign(new Error('down'), { status: 503 }); };

    const registry = new AIProviderRegistry().register({ id: 'bad', provider: bad, capabilities: ['generate'] });
    const router = new YrakAIRouter(
      registry,
      { development: { SUPPORT_RESPONSE: ['bad', 'bad', 'bad'] } },
      { maxAttempts: 2 },
    );

    await expect(router.generate('development', 'SUPPORT_RESPONSE', { system: 's', prompt: 'p' })).rejects.toThrow('down');
    expect(calls).toBe(1);
  });

  it('does not fallback on a non-retryable error', async () => {
    const first = provider('unused');
    first.generate = async () => { throw Object.assign(new Error('bad request'), { status: 400 }); };

    const registry = new AIProviderRegistry()
      .register({ id: 'first', provider: first, capabilities: ['generate'] })
      .register({ id: 'second', provider: provider('must-not-run'), capabilities: ['generate'] });

    const router = new YrakAIRouter(registry, {
      development: { SUPPORT_RESPONSE: ['first', 'second'] },
    });

    await expect(router.generate('development', 'SUPPORT_RESPONSE', { system: 's', prompt: 'p' })).rejects.toThrow('bad request');
  });
});
