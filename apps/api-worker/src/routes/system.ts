import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
import { requireRoles } from '../middleware.js';
import { createAIProvider } from '../services/ai-service.js';

export const systemRoutes = new Hono<AppBindings>();
systemRoutes.use('*', requireRoles('ADMIN', 'HR', 'AUDITOR'));

systemRoutes.get('/health', async (c) => {
  let database: 'healthy' | 'down' = 'healthy';
  try {
    await c.env.DB.prepare('SELECT 1 AS ok').first();
  } catch {
    database = 'down';
  }
  return c.json({
    service: 'yrak-suterm-coberturas-api',
    environment: c.env.APP_ENV,
    database,
    r2: c.env.EVIDENCE_BUCKET ? 'configured' : 'not_configured',
    workersAi: c.env.AI ? 'configured' : 'not_configured',
    queue: c.env.NOTIFICATIONS_QUEUE ? 'configured' : 'not_configured',
    workflow: c.env.COVERAGE_WORKFLOW ? 'configured' : 'not_configured',
    email: c.env.EMAIL ? 'configured' : 'not_configured',
  });
});

systemRoutes.get('/integrations', (c) => {
  const compatibleId = c.env.AI_COMPAT_PROVIDER_ID?.trim().toLowerCase() ?? '';
  const integrations = [
    { id: 'cloudflare', configured: Boolean(c.env.DB), detail: 'D1 / Workers bindings' },
    { id: 'supabase', configured: Boolean(c.env.SUPABASE_URL), detail: 'Postgres / pgvector' },
    { id: 'upstash', configured: Boolean(c.env.UPSTASH_REDIS_REST_URL), detail: 'Redis REST' },
    { id: 'modal', configured: Boolean(c.env.MODAL_ENDPOINT_URL), detail: 'GPU endpoint' },
    { id: 'nvidia', configured: compatibleId.includes('nvidia') && Boolean(c.env.AI_COMPAT_API_KEY), detail: 'OpenAI-compatible provider' },
    { id: 'huggingface', configured: Boolean(c.env.HUGGINGFACE_TOKEN), detail: 'Model registry token' },
    { id: 'ollama', configured: Boolean(c.env.OLLAMA_BASE_URL) || compatibleId.includes('ollama'), detail: 'Local OpenAI-compatible endpoint' },
    { id: 'gmail', configured: Boolean(c.env.GMAIL_TEST_ADDRESS), detail: 'Test mailbox identity' },
  ];
  return c.json({ items: integrations });
});

systemRoutes.post('/ai-smoke-test', requireRoles('ADMIN', 'HR'), async (c) => {
  if (c.env.APP_ENV === 'production') return c.json({ error: 'AI_SMOKE_TEST_DISABLED_IN_PRODUCTION' }, 403);
  const started = Date.now();
  const provider = createAIProvider(c.env);
  const text = await provider.generate({
    system: 'Prueba técnica sintética de YRAK. No uses herramientas ni datos externos.',
    prompt: 'Responde únicamente con YRAK_OK.',
  });
  const configuredProvider = c.env.AI_PROVIDER ?? 'workers-ai';
  const model = configuredProvider === 'compatible'
    ? c.env.AI_COMPAT_TEXT_MODEL
    : configuredProvider === 'openai'
      ? c.env.OPENAI_TEXT_MODEL
      : configuredProvider === 'anthropic'
        ? c.env.ANTHROPIC_TEXT_MODEL
        : c.env.WORKERS_AI_TEXT_MODEL;
  return c.json({
    ok: text.trim().includes('YRAK_OK'),
    provider: configuredProvider,
    model: model ?? null,
    latencyMs: Date.now() - started,
    responseChars: text.length,
  });
});
