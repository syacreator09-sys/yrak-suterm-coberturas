import { api } from '../core/api-client.js';
import type { PageContext } from '../core/page-context.js';
import { renderAlert, renderHealth, renderLoading } from '../components/ui.js';
import { renderPageError } from '../core/page-utils.js';

type StatusResponse = { items: Array<{ id: string; configured: boolean }> };

export async function renderRag(ctx: PageContext): Promise<void> {
  ctx.setTitle('RAG', 'Conocimiento, recuperación y trazabilidad de fuentes');
  ctx.root.innerHTML = renderLoading('Consultando configuración RAG…');
  try {
    const status = await api.get<StatusResponse>('/v1/system/integrations');
    const supabaseConfigured = status.items.find((item) => item.id === 'supabase')?.configured ?? false;
    ctx.root.innerHTML = `<div class="page-stack">
      ${renderAlert('El RAG no participa en rotaciones, elegibilidad, ranking ni adjudicación. Sólo recuperará información autorizada y deberá conservar fuentes/citas.', 'info')}
      <section class="page-grid">
        <article class="panel span-7"><div class="section-heading"><div><h2>Pipeline previsto</h2><p>Estado real; no se simulan etapas completadas.</p></div></div>
          <div class="timeline" style="margin-top:16px">
            ${[
              ['R2 / documentos originales', 'Pendiente de conexión/ingestión específica'],
              ['Parser / OCR', 'Pendiente de pipeline'],
              ['Chunking', 'Pendiente de pipeline'],
              ['Embeddings', 'Pendiente de selección y ejecución'],
              ['Supabase pgvector', supabaseConfigured ? 'Configuración detectada; esquema RAG aún debe validarse' : 'No configurado'],
              ['Retrieval híbrido', 'Pendiente de RAG Core'],
              ['Reranking', 'Pendiente de Modal/NVIDIA'],
              ['Contexto + citas', 'Pendiente de RAG Core'],
            ].map(([name, state]) => `<div class="timeline-item"><span class="timeline-dot"></span><div class="timeline-content"><strong>${name}</strong><span>${state}</span></div></div>`).join('')}
          </div>
        </article>
        <article class="panel span-5"><h2>Estado</h2><div class="integration-card card"><header><h3>Supabase / pgvector</h3>${renderHealth(supabaseConfigured ? 'unknown' : 'not_configured')}</header><p>${supabaseConfigured ? 'La configuración existe, pero todavía no se declara healthy sin probar esquema, conexión y consulta vectorial.' : 'Conecta Supabase para iniciar la fase RAG.'}</p></div>
          <div class="integration-card card" style="margin-top:12px"><header><h3>Consulta RAG</h3>${renderHealth('not_configured')}</header><p>El botón de consulta permanece deshabilitado hasta existir un endpoint RAG con ACL, retrieval y citas verificados.</p><button class="secondary" type="button" disabled>Probar búsqueda RAG</button></div>
        </article>
      </section>
    </div>`;
  } catch (error) {
    ctx.root.innerHTML = renderPageError(error);
  }
}
