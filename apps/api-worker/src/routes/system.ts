import { Hono } from 'hono';
import type { AppBindings, AppEnv } from '../env.js';
import { requireRoles } from '../middleware.js';
import { createAIProvider } from '../services/ai-service.js';
import { ragConfigurationState } from '../services/rag-service.js';

export const systemRoutes = new Hono<AppBindings>();
systemRoutes.use('*', requireRoles('ADMIN', 'HR', 'AUDITOR'));

function configuredAi(env: AppEnv): { provider: string; model: string | null } {
  const mode = env.AI_PROVIDER ?? 'workers-ai';
  const provider = mode === 'compatible' ? (env.AI_COMPAT_PROVIDER_ID?.trim() || 'compatible') : mode;
  const model = mode === 'compatible'
    ? env.AI_COMPAT_TEXT_MODEL
    : mode === 'openai'
      ? env.OPENAI_TEXT_MODEL
      : mode === 'anthropic'
        ? env.ANTHROPIC_TEXT_MODEL
        : env.WORKERS_AI_TEXT_MODEL;
  return { provider, model: model ?? null };
}

systemRoutes.get('/health', async (c) => {
  let database: 'healthy' | 'down' = 'healthy';
  try {
    await c.env.DB.prepare('SELECT 1 AS ok').first();
  } catch {
    database = 'down';
  }
  const ai = configuredAi(c.env);
  return c.json({
    service: 'yrak-suterm-coberturas-api',
    environment: c.env.APP_ENV,
    database,
    r2: c.env.EVIDENCE_BUCKET ? 'configured' : 'not_configured',
    workersAi: c.env.AI ? 'configured' : 'not_configured',
    queue: c.env.NOTIFICATIONS_QUEUE ? 'configured' : 'not_configured',
    workflow: c.env.COVERAGE_WORKFLOW ? 'configured' : 'not_configured',
    email: c.env.EMAIL ? 'configured' : 'not_configured',
    aiProvider: ai.provider,
    aiModel: ai.model,
  });
});

systemRoutes.get('/integrations', (c) => {
  const compatibleId = c.env.AI_COMPAT_PROVIDER_ID?.trim().toLowerCase() ?? '';
  const compatibleReady = Boolean(c.env.AI_COMPAT_BASE_URL && c.env.AI_COMPAT_TEXT_MODEL);
  const rag = ragConfigurationState(c.env);
  const supabaseDeclared = Boolean(c.env.SUPABASE_URL || c.env.SUPABASE_SECRET_KEY);
  const embeddingDeclared = Boolean(c.env.RAG_EMBEDDING_BASE_URL || c.env.RAG_EMBEDDING_MODEL || c.env.RAG_EMBEDDING_API_KEY);
  const integrations = [
    { id: 'cloudflare', implemented: true, configured: Boolean(c.env.DB), detail: 'D1 / Workers bindings' },
    {
      id: 'supabase',
      implemented: true,
      configured: rag.supabase && rag.embeddings,
      declared: supabaseDeclared || embeddingDeclared,
      detail: rag.supabase && rag.embeddings
        ? 'Runtime pgvector + embeddings configurado; falta/depende de smoke de esquema y consulta'
        : supabaseDeclared || embeddingDeclared
          ? 'Configuración RAG parcial: requiere Supabase URL + secret key + embedding endpoint/model'
          : 'Adapter pgvector implementado; credenciales/runtime no configurados',
    },
    {
      id: 'upstash',
      implemented: false,
      configured: false,
      declared: Boolean(c.env.UPSTASH_REDIS_REST_URL),
      detail: c.env.UPSTASH_REDIS_REST_URL ? 'URL detectada; adapter de cache pendiente' : 'Adapter de cache opcional pendiente',
    },
    {
      id: 'modal',
      implemented: false,
      configured: false,
      declared: Boolean(c.env.MODAL_ENDPOINT_URL),
      detail: c.env.MODAL_ENDPOINT_URL ? 'Endpoint detectado; contrato/job adapter pendiente' : 'Adapter de compute pendiente',
    },
    { id: 'nvidia', implemented: true, configured: compatibleReady && compatibleId.includes('nvidia') && Boolean(c.env.AI_COMPAT_API_KEY), detail: 'OpenAI-compatible provider' },
    {
      id: 'huggingface',
      implemented: false,
      configured: false,
      declared: Boolean(c.env.HUGGINGFACE_TOKEN),
      detail: c.env.HUGGINGFACE_TOKEN ? 'Token detectado; adapter/model workflow pendiente' : 'Adapter/model workflow pendiente',
    },
    { id: 'ollama', implemented: true, configured: compatibleReady && compatibleId.includes('ollama'), detail: 'Local OpenAI-compatible endpoint' },
    {
      id: 'gmail',
      implemented: false,
      configured: false,
      declared: Boolean(c.env.GMAIL_TEST_ADDRESS),
      detail: c.env.GMAIL_TEST_ADDRESS ? 'Mailbox detectado; OAuth/Gmail adapter pendiente' : 'OAuth/Gmail adapter pendiente',
    },
  ];
  return c.json({ items: integrations });
});

systemRoutes.post('/ai-smoke-test', requireRoles('ADMIN', 'HR'), async (c) => {
  if (c.env.APP_ENV === 'production') return c.json({ error: 'AI_SMOKE_TEST_DISABLED_IN_PRODUCTION' }, 403);
  const started = Date.now();
  const configured = configuredAi(c.env);
  try {
    const provider = createAIProvider(c.env);
    const text = await provider.generate({
      system: 'Prueba técnica sintética de YRAK. No uses herramientas ni datos externos.',
      prompt: 'Responde únicamente con YRAK_OK.',
    });
    return c.json({
      ok: text.trim().includes('YRAK_OK'),
      provider: configured.provider,
      model: configured.model,
      latencyMs: Date.now() - started,
      responseChars: text.length,
    });
  } catch (error) {
    console.error('AI_SMOKE_TEST_FAILED', error instanceof Error ? error.name : 'UNKNOWN_ERROR');
    return c.json({
      ok: false,
      error: 'AI_SMOKE_TEST_FAILED',
      provider: configured.provider,
      model: configured.model,
      latencyMs: Date.now() - started,
      responseChars: 0,
    }, 503);
  }
});
