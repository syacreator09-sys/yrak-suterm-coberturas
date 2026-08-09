import {
  AnthropicProvider,
  OpenAICompatibleProvider,
  OpenAIProvider,
  WorkersAIProvider,
  type AIProvider,
} from '@yrak/ai-provider';
import type { AppEnv } from '../env.js';

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function createAIProvider(env: AppEnv): AIProvider {
  switch (env.AI_PROVIDER) {
    case 'openai':
      if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
      return new OpenAIProvider({
        apiKey: env.OPENAI_API_KEY,
        textModel: env.OPENAI_TEXT_MODEL ?? 'gpt-5.6-luna',
        transcriptionModel: env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-4o-transcribe',
      });
    case 'anthropic':
      if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY_NOT_CONFIGURED');
      return new AnthropicProvider({
        apiKey: env.ANTHROPIC_API_KEY,
        textModel: env.ANTHROPIC_TEXT_MODEL ?? 'claude-sonnet-5',
      });
    case 'compatible': {
      if (!env.AI_COMPAT_BASE_URL || !env.AI_COMPAT_TEXT_MODEL) {
        throw new Error('AI_COMPAT_PROVIDER_NOT_CONFIGURED');
      }
      return new OpenAICompatibleProvider({
        providerId: env.AI_COMPAT_PROVIDER_ID ?? 'compatible',
        baseUrl: env.AI_COMPAT_BASE_URL,
        textModel: env.AI_COMPAT_TEXT_MODEL,
        ...(env.AI_COMPAT_API_KEY ? { apiKey: env.AI_COMPAT_API_KEY } : {}),
        ...(env.AI_COMPAT_TRANSCRIPTION_MODEL
          ? { transcriptionModel: env.AI_COMPAT_TRANSCRIPTION_MODEL }
          : {}),
        timeoutMs: positiveInt(env.AI_REQUEST_TIMEOUT_MS, 30_000),
      });
    }
    case 'workers-ai':
    default:
      if (!env.AI) throw new Error('WORKERS_AI_NOT_CONFIGURED');
      return new WorkersAIProvider(
        env.AI as unknown as { run(model: string, input: unknown): Promise<unknown> },
        {
          textModel: env.WORKERS_AI_TEXT_MODEL ?? '@cf/meta/llama-3.1-8b-instruct-fast',
          transcriptionModel: env.WORKERS_AI_TRANSCRIPTION_MODEL ?? '@cf/openai/whisper-large-v3-turbo',
        },
      );
  }
}
