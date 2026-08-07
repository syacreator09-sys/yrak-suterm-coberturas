import type { z } from 'zod';

export interface AIProvider {
  transcribe(input: { bytes: ArrayBuffer; mimeType: string; language?: string }): Promise<{ text: string; confidence?: number }>;
  extract<T>(input: { system: string; content: string }, schema: z.ZodType<T>): Promise<T>;
  generate(input: { system: string; prompt: string }): Promise<string>;
}

export class AIProviderUnavailableError extends Error {
  constructor() { super('AI provider is not configured'); }
}
