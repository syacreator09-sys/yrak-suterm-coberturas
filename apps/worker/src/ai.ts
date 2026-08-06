import { OpenAIResponsesProvider } from '@yrak/ai-provider';
import type { AIProvider } from '@yrak/ai-provider';
import type { Env } from './types.js';

export function getGenerativeProvider(env: Env): AIProvider | null {
  if (env.GENERATIVE_PROVIDER === 'openai' && env.OPENAI_API_KEY && env.OPENAI_MODEL) {
    return new OpenAIResponsesProvider({
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
    });
  }
  return null;
}
