import type { z } from 'zod';

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
}

export interface AIProvider {
  transcribe(input: {
    bytes: ArrayBuffer;
    mimeType: string;
    language?: string;
    context?: string;
  }): Promise<TranscriptionResult>;
  extract<T>(input: { prompt: string; content: string }, schema: z.ZodType<T>): Promise<T>;
  generate(input: { system: string; prompt: string }): Promise<string>;
}

export interface WorkersAILike {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export class WorkersAIProvider implements AIProvider {
  public constructor(private readonly ai: WorkersAILike) {}

  public async transcribe(input: {
    bytes: ArrayBuffer;
    mimeType: string;
    language?: string;
    context?: string;
  }): Promise<TranscriptionResult> {
    const result = await this.ai.run('@cf/openai/whisper-large-v3-turbo', {
      audio: [...new Uint8Array(input.bytes)],
      task: 'transcribe',
      language: input.language ?? 'es',
      vad_filter: true,
      initial_prompt: input.context ?? 'Coberturas temporales, niveles y personal SUTERM.',
    });
    if (!result || typeof result !== 'object' || !('text' in result)) {
      throw new Error('Workers AI no devolvió una transcripción válida');
    }
    const record = result as { text: unknown; confidence?: unknown; language?: unknown };
    return {
      text: String(record.text),
      ...(typeof record.confidence === 'number' ? { confidence: record.confidence } : {}),
      ...(typeof record.language === 'string' ? { language: record.language } : {}),
    };
  }

  public async extract<T>(_input: { prompt: string; content: string }, _schema: z.ZodType<T>): Promise<T> {
    throw new Error('La extracción estructurada requiere configurar un proveedor generativo');
  }

  public async generate(_input: { system: string; prompt: string }): Promise<string> {
    throw new Error('La generación de texto requiere configurar un proveedor generativo');
  }
}

export class MockAIProvider implements AIProvider {
  public constructor(private readonly transcription = 'Transcripción de prueba') {}

  public async transcribe(): Promise<TranscriptionResult> {
    return { text: this.transcription, confidence: 1, language: 'es' };
  }

  public async extract<T>(_input: { prompt: string; content: string }, schema: z.ZodType<T>): Promise<T> {
    return schema.parse({});
  }

  public async generate(input: { system: string; prompt: string }): Promise<string> {
    return `${input.system}\n\n${input.prompt}`;
  }
}
