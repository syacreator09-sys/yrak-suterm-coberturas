import {
  OpenAICompatibleEmbeddingProvider,
  RagController,
  SupabasePgvectorRetriever,
} from '@yrak/rag';
import type { AppEnv } from '../env.js';

export class RagConfigurationError extends Error {
  constructor() {
    super('RAG_NOT_CONFIGURED');
    this.name = 'RagConfigurationError';
  }
}

function timeoutMs(value: string | undefined): number {
  const parsed = Number(value ?? '30000');
  if (!Number.isFinite(parsed)) return 30_000;
  return Math.max(1_000, Math.min(120_000, Math.trunc(parsed)));
}

export function ragConfigurationState(env: AppEnv) {
  return {
    supabase: Boolean(env.SUPABASE_URL?.trim() && env.SUPABASE_SECRET_KEY?.trim()),
    embeddings: Boolean(env.RAG_EMBEDDING_BASE_URL?.trim() && env.RAG_EMBEDDING_MODEL?.trim()),
  };
}

export function createRagController(env: AppEnv): RagController {
  const state = ragConfigurationState(env);
  if (!state.supabase || !state.embeddings) throw new RagConfigurationError();

  const requestTimeoutMs = timeoutMs(env.RAG_REQUEST_TIMEOUT_MS);
  const embeddings = new OpenAICompatibleEmbeddingProvider({
    baseUrl: env.RAG_EMBEDDING_BASE_URL!,
    model: env.RAG_EMBEDDING_MODEL!,
    ...(env.RAG_EMBEDDING_API_KEY?.trim() ? { apiKey: env.RAG_EMBEDDING_API_KEY.trim() } : {}),
    timeoutMs: requestTimeoutMs,
  });
  const retriever = new SupabasePgvectorRetriever({
    url: env.SUPABASE_URL!,
    secretKey: env.SUPABASE_SECRET_KEY!,
    ...(env.SUPABASE_RAG_RPC?.trim() ? { rpcName: env.SUPABASE_RAG_RPC.trim() } : {}),
    timeoutMs: requestTimeoutMs,
  }, embeddings);
  return new RagController(retriever);
}
