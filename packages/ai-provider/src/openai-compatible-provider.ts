import type { z } from 'zod';
import type { AIProvider } from './provider.js';
import { AIProviderOperationUnsupportedError, parseJsonText } from './provider.js';

interface ChatCompletionsResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export class AIProviderHttpError extends Error {
  constructor(
    public readonly providerId: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AIProviderHttpError';
  }
}

export interface OpenAICompatibleProviderConfig {
  providerId: string;
  baseUrl: string;
  textModel: string;
  apiKey?: string;
  transcriptionModel?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

async function readJson<T>(response: Response): Promise<T | null> {
  const raw = await response.text();
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export class OpenAICompatibleProvider implements AIProvider {
  constructor(private readonly config: OpenAICompatibleProviderConfig) {}

  private get baseUrl(): string {
    return this.config.baseUrl.replace(/\/$/, '');
  }

  private get fetchImpl(): typeof fetch {
    return this.config.fetchImpl ?? fetch.bind(globalThis);
  }

  private headers(contentType = true): Record<string, string> {
    const headers: Record<string, string> = { ...(this.config.headers ?? {}) };
    if (contentType) headers['content-type'] = 'application/json';
    if (this.config.apiKey) headers.authorization = `Bearer ${this.config.apiKey}`;
    return headers;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs ?? 30_000);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('AI_TIMEOUT');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async generate(input: { system: string; prompt: string }): Promise<string> {
    const response = await this.request(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.config.textModel,
        stream: false,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.prompt },
        ],
      }),
    });
    const json = await readJson<ChatCompletionsResponse>(response);
    if (!response.ok) {
      throw new AIProviderHttpError(
        this.config.providerId,
        response.status,
        json?.error?.message ?? `AI_COMPAT_HTTP_${response.status}`,
      );
    }
    if (!json) throw new Error('AI_COMPAT_INVALID_RESPONSE');
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('AI_COMPAT_EMPTY_RESPONSE');
    return text;
  }

  async extract<T>(
    input: { system: string; content: string },
    schema: z.ZodType<T>,
  ): Promise<T> {
    const text = await this.generate({
      system: `${input.system}\nDevuelve exclusivamente un objeto JSON válido, sin markdown.`,
      prompt: input.content,
    });
    return schema.parse(parseJsonText(text));
  }

  async transcribe(input: { bytes: ArrayBuffer; mimeType: string; language?: string }) {
    if (!this.config.transcriptionModel) {
      throw new AIProviderOperationUnsupportedError('transcribe');
    }
    const form = new FormData();
    form.set('file', new File([input.bytes], 'audio', { type: input.mimeType }));
    form.set('model', this.config.transcriptionModel);
    if (input.language) form.set('language', input.language);

    const response = await this.request(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: this.headers(false),
      body: form,
    });
    const json = await readJson<{ text?: string; error?: { message?: string } }>(response);
    if (!response.ok) {
      throw new AIProviderHttpError(
        this.config.providerId,
        response.status,
        json?.error?.message ?? `AI_COMPAT_TRANSCRIPTION_HTTP_${response.status}`,
      );
    }
    if (!json) throw new Error('AI_COMPAT_INVALID_RESPONSE');
    if (!json.text) throw new Error('AI_COMPAT_EMPTY_TRANSCRIPT');
    return { text: json.text };
  }
}
