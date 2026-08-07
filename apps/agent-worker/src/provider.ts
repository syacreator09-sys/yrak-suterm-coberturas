import {
  AIProviderRegistry,
  OpenAICompatibleProvider,
  TaskScopedAIProvider,
  WorkersAIProvider,
  YrakAIRouter,
  createDefaultRoutingPolicy,
  type AIProfile,
  type AITask,
} from '@yrak/ai-provider';
import type { Env } from './env.js';

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function profile(env: Env): AIProfile {
  return env.AI_PROFILE ?? 'production';
}

export function createAIRouter(env: Env): YrakAIRouter {
  const registry = new AIProviderRegistry();
  const workersTextModel = env.WORKERS_AI_TEXT_MODEL ?? '@cf/meta/llama-3.1-8b-instruct-fast';

  registry.register({
    id: 'workers-ai',
    provider: new WorkersAIProvider(
      env.AI as unknown as { run(model: string, input: unknown): Promise<unknown> },
      {
        textModel: workersTextModel,
        transcriptionModel: env.WORKERS_AI_TRANSCRIPTION_MODEL ?? '@cf/openai/whisper-large-v3-turbo',
      },
    ),
    model: workersTextModel,
    capabilities: ['generate', 'extract', 'transcribe'],
  });

  const compatibleId = env.AI_COMPAT_PROVIDER_ID?.trim();
  if (compatibleId && env.AI_COMPAT_BASE_URL && env.AI_COMPAT_TEXT_MODEL) {
    registry.register({
      id: compatibleId,
      provider: new OpenAICompatibleProvider({
        providerId: compatibleId,
        baseUrl: env.AI_COMPAT_BASE_URL,
        textModel: env.AI_COMPAT_TEXT_MODEL,
        ...(env.AI_COMPAT_API_KEY ? { apiKey: env.AI_COMPAT_API_KEY } : {}),
        ...(env.AI_COMPAT_TRANSCRIPTION_MODEL
          ? { transcriptionModel: env.AI_COMPAT_TRANSCRIPTION_MODEL }
          : {}),
        timeoutMs: positiveInt(env.AI_REQUEST_TIMEOUT_MS, 30_000),
      }),
      model: env.AI_COMPAT_TEXT_MODEL,
      capabilities: [
        'generate',
        'extract',
        ...(env.AI_COMPAT_TRANSCRIPTION_MODEL ? (['transcribe'] as const) : []),
      ],
    });
  }

  return new YrakAIRouter(
    registry,
    createDefaultRoutingPolicy({ compatibleProviderId: compatibleId }),
    { maxAttempts: positiveInt(env.AI_MAX_PROVIDER_ATTEMPTS, 2) },
  );
}

export function provider(env: Env, task: AITask) {
  return new TaskScopedAIProvider(createAIRouter(env), profile(env), task);
}
