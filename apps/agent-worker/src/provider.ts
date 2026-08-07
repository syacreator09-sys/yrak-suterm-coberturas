import { WorkersAIProvider } from '@yrak/ai-provider';
import type { Env } from './env.js';

export function provider(env: Env) {
  return new WorkersAIProvider(
    env.AI as unknown as { run(model: string, input: unknown): Promise<unknown> },
    {
      textModel: env.WORKERS_AI_TEXT_MODEL ?? '@cf/meta/llama-3.1-8b-instruct-fast',
      transcriptionModel: '@cf/openai/whisper-large-v3-turbo',
    },
  );
}
