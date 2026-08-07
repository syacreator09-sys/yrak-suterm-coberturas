import type { z } from 'zod';
import type { AIProvider } from './provider.js';

export class MockAIProvider implements AIProvider {
  constructor(private readonly fixtures: { transcript?: string; generated?: string; extracted?: unknown } = {}) {}
  async transcribe(): Promise<{ text: string; confidence?: number }> { return { text: this.fixtures.transcript ?? '', confidence: 1 }; }
  async extract<T>(_input: { system: string; content: string }, schema: z.ZodType<T>): Promise<T> { return schema.parse(this.fixtures.extracted ?? {}); }
  async generate(): Promise<string> { return this.fixtures.generated ?? ''; }
}
