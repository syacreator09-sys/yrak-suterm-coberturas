import { describe, expect, it } from 'vitest';
import type { AppEnv } from '../env.js';
import { createRagController, RagConfigurationError, ragConfigurationState } from './rag-service.js';

function env(overrides: Partial<AppEnv> = {}): AppEnv {
  return overrides as AppEnv;
}

describe('RAG service configuration', () => {
  it('requires both Supabase server credentials and an embedding endpoint/model', () => {
    expect(ragConfigurationState(env())).toEqual({ supabase: false, embeddings: false });
    expect(ragConfigurationState(env({ SUPABASE_URL: 'https://project.supabase.co' }))).toEqual({ supabase: false, embeddings: false });
    expect(ragConfigurationState(env({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SECRET_KEY: 'secret',
      RAG_EMBEDDING_BASE_URL: 'http://127.0.0.1:11434/v1',
      RAG_EMBEDDING_MODEL: 'embed-model',
    }))).toEqual({ supabase: true, embeddings: true });
  });

  it('fails closed before creating adapters when required configuration is missing', () => {
    expect(() => createRagController(env())).toThrow(RagConfigurationError);
  });
});
