export interface IntegrationDescriptor {
  id: string;
  name: string;
  purpose: string;
  dashboardUrl: string;
}

export const integrations: readonly IntegrationDescriptor[] = [
  { id: 'cloudflare', name: 'Cloudflare', purpose: 'Workers, D1, R2, Queues, Workflows, Durable Objects y Workers AI', dashboardUrl: 'https://dash.cloudflare.com/' },
  { id: 'supabase', name: 'Supabase', purpose: 'Postgres + pgvector para RAG y metadatos de conocimiento', dashboardUrl: 'https://supabase.com/dashboard' },
  { id: 'upstash', name: 'Upstash', purpose: 'Redis serverless para cache y estado efímero', dashboardUrl: 'https://console.upstash.com/' },
  { id: 'modal', name: 'Modal', purpose: 'GPU/compute para jobs pesados, embeddings y reranking', dashboardUrl: 'https://modal.com/' },
  { id: 'nvidia', name: 'NVIDIA NIM', purpose: 'Proveedor de inferencia OpenAI-compatible para pruebas y fallback', dashboardUrl: 'https://build.nvidia.com/' },
  { id: 'huggingface', name: 'Hugging Face', purpose: 'Registro de modelos, embeddings y rerankers', dashboardUrl: 'https://huggingface.co/' },
  { id: 'ollama', name: 'Ollama', purpose: 'Pruebas locales con modelos OpenAI-compatible', dashboardUrl: 'https://ollama.com/' },
  { id: 'gmail', name: 'Gmail de pruebas', purpose: 'Buzón dedicado para validar flujos de correo', dashboardUrl: 'https://mail.google.com/' },
];
