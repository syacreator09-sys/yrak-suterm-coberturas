import { z } from 'zod';

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
}

export interface ImageAnalysisInput {
  bytes: ArrayBuffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  prompt: string;
}

export interface AIProvider {
  transcribe(input: {
    bytes: ArrayBuffer;
    mimeType: string;
    language?: string;
    context?: string;
  }): Promise<TranscriptionResult>;
  extract<T>(input: { prompt: string; content: string }, schema: z.ZodType<T>): Promise<T>;
  analyzeImage<T>(input: ImageAnalysisInput, schema: z.ZodType<T>): Promise<T>;
  generate(input: { system: string; prompt: string }): Promise<string>;
}

export interface WorkersAILike {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

function arrayBufferToBase64(bytes: ArrayBuffer): string {
  const array = new Uint8Array(bytes);
  let binary = '';
  const chunkSize = 32_768;
  for (let offset = 0; offset < array.length; offset += chunkSize) {
    binary += String.fromCharCode(...array.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function extractOpenAIText(response: unknown): string {
  if (!response || typeof response !== 'object') throw new Error('Respuesta de OpenAI inválida');
  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) throw new Error('OpenAI no devolvió contenido');
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part && typeof part === 'object' && (part as { type?: unknown }).type === 'output_text') {
        const text = (part as { text?: unknown }).text;
        if (typeof text === 'string') return text;
      }
    }
  }
  throw new Error('OpenAI no devolvió output_text');
}

function jsonSchemaFor<T>(schema: z.ZodType<T>): Record<string, unknown> {
  const converted = z.toJSONSchema(schema) as Record<string, unknown>;
  const { $schema: _schema, ...jsonSchema } = converted;
  return jsonSchema;
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
    throw new Error('La extracción estructurada requiere un proveedor generativo');
  }

  public async analyzeImage<T>(_input: ImageAnalysisInput, _schema: z.ZodType<T>): Promise<T> {
    throw new Error('El análisis de imágenes requiere un proveedor multimodal');
  }

  public async generate(_input: { system: string; prompt: string }): Promise<string> {
    throw new Error('La generación de texto requiere un proveedor generativo');
  }
}

export interface OpenAIProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export class OpenAIResponsesProvider implements AIProvider {
  readonly #baseUrl: string;

  public constructor(private readonly config: OpenAIProviderConfig) {
    this.#baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';
  }

  async #request(body: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.#baseUrl}/responses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
        'x-client-request-id': crypto.randomUUID(),
      },
      body: JSON.stringify({ ...body, model: this.config.model, store: false }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`OpenAI Responses API ${response.status}: ${detail.slice(0, 500)}`);
    }
    return response.json();
  }

  public async transcribe(): Promise<TranscriptionResult> {
    throw new Error('Use WorkersAIProvider para transcripción de audio');
  }

  public async extract<T>(
    input: { prompt: string; content: string },
    schema: z.ZodType<T>,
  ): Promise<T> {
    const response = await this.#request({
      instructions: input.prompt,
      input: input.content,
      text: {
        format: {
          type: 'json_schema',
          name: 'yrak_structured_result',
          schema: jsonSchemaFor(schema),
          strict: true,
        },
      },
    });
    return schema.parse(JSON.parse(extractOpenAIText(response)));
  }

  public async analyzeImage<T>(input: ImageAnalysisInput, schema: z.ZodType<T>): Promise<T> {
    const dataUrl = `data:${input.mimeType};base64,${arrayBufferToBase64(input.bytes)}`;
    const response = await this.#request({
      instructions: input.prompt,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Extrae únicamente los datos visibles y explícitos.' },
            { type: 'input_image', image_url: dataUrl, detail: 'high' },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'yrak_image_result',
          schema: jsonSchemaFor(schema),
          strict: true,
        },
      },
    });
    return schema.parse(JSON.parse(extractOpenAIText(response)));
  }

  public async generate(input: { system: string; prompt: string }): Promise<string> {
    const response = await this.#request({ instructions: input.system, input: input.prompt });
    return extractOpenAIText(response);
  }
}

export class MockAIProvider implements AIProvider {
  public constructor(
    private readonly transcription = 'Transcripción de prueba',
    private readonly structuredOutput: unknown = {},
  ) {}

  public async transcribe(): Promise<TranscriptionResult> {
    return { text: this.transcription, confidence: 1, language: 'es' };
  }

  public async extract<T>(_input: { prompt: string; content: string }, schema: z.ZodType<T>): Promise<T> {
    return schema.parse(this.structuredOutput);
  }

  public async analyzeImage<T>(_input: ImageAnalysisInput, schema: z.ZodType<T>): Promise<T> {
    return schema.parse(this.structuredOutput);
  }

  public async generate(input: { system: string; prompt: string }): Promise<string> {
    return `${input.system}\n\n${input.prompt}`;
  }
}
