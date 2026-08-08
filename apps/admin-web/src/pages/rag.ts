import { api, ApiError } from '../core/api-client.js';
import type { PageContext } from '../core/page-context.js';
import { renderAlert, renderBadge, renderHealth, renderLoading } from '../components/ui.js';
import { renderPageError } from '../core/page-utils.js';
import { escapeText } from '../core/security.js';

type StatusResponse = {
  items: Array<{
    id: string;
    implemented?: boolean;
    configured: boolean;
    declared?: boolean;
    detail?: string;
  }>;
};

type RagChunk = {
  chunkId: string;
  documentId: string;
  text: string;
  score: number;
  page?: number | null;
  section?: string | null;
  documentVersion?: string | null;
  source?: string | null;
};

type RagCitation = {
  documentId: string;
  chunkId: string;
  page?: number | null;
  section?: string | null;
  documentVersion?: string | null;
  source?: string | null;
};

type RagSearchResponse = { items: RagChunk[]; citations: RagCitation[] };

function renderResults(result: RagSearchResponse): string {
  if (!result.items.length) {
    return `<div class="empty-state"><strong>Sin resultados autorizados</strong><p>No se encontraron chunks dentro del scope del usuario actual.</p></div>`;
  }
  const citationByChunk = new Map(result.citations.map((citation) => [citation.chunkId, citation]));
  return `<div class="page-stack">${result.items.map((chunk, index) => {
    const citation = citationByChunk.get(chunk.chunkId);
    const score = Number.isFinite(chunk.score) ? chunk.score.toFixed(3) : '—';
    const sourceParts = [
      citation?.documentVersion ? `v${citation.documentVersion}` : null,
      citation?.page ? `p. ${citation.page}` : null,
      citation?.section ?? null,
    ].filter(Boolean).join(' · ');
    return `<article class="card">
      <div class="section-heading"><div><h3>Resultado ${index + 1}</h3><p>Documento ${escapeText(chunk.documentId)}</p></div>${renderBadge(`score ${score}`, 'info')}</div>
      <p class="mt-12">${escapeText(chunk.text)}</p>
      <div class="toolbar mt-12">
        <span class="badge badge-neutral">Chunk ${escapeText(chunk.chunkId)}</span>
        ${sourceParts ? `<span class="badge badge-neutral">${escapeText(sourceParts)}</span>` : ''}
        ${citation?.source ? `<span class="badge badge-neutral">Fuente registrada</span>` : ''}
      </div>
    </article>`;
  }).join('')}</div>`;
}

function ragErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'No se pudo ejecutar la consulta RAG.';
  if (error.code === 'RAG_NOT_CONFIGURED') return 'RAG aún no está configurado en el servidor.';
  if (error.code === 'RAG_RETRIEVAL_UNAVAILABLE') return 'El proveedor de embeddings o Supabase no está disponible.';
  if (error.code === 'RAG_RETRIEVAL_BLOCKED') return 'La respuesta fue bloqueada porque un resultado violó el scope de autorización.';
  if (error.status === 403) return 'Tu rol no tiene acceso a la búsqueda RAG.';
  return `${error.code}${error.correlationId ? ` · ${error.correlationId}` : ''}`;
}

export async function renderRag(ctx: PageContext): Promise<void> {
  ctx.setTitle('RAG Center', 'Conocimiento, recuperación y trazabilidad de fuentes');
  ctx.root.innerHTML = renderLoading('Consultando configuración RAG…');
  try {
    const status = await api.get<StatusResponse>('/v1/system/integrations');
    const supabase = status.items.find((item) => item.id === 'supabase');
    const ragConfigured = supabase?.configured ?? false;
    const stateText = ragConfigured
      ? 'Runtime declarado. La salud real se confirma únicamente ejecutando una búsqueda.'
      : escapeText(supabase?.detail ?? 'Supabase/embeddings no configurados.');

    ctx.root.innerHTML = `<div class="page-stack">
      ${renderAlert('El RAG sólo recupera información autorizada y devuelve fuentes/citas. No participa en rotaciones, elegibilidad, ranking ni adjudicación.', 'info')}
      <section class="page-grid">
        <article class="panel span-7">
          <div class="section-heading"><div><h2>Búsqueda autorizada</h2><p>La consulta se filtra por organización/grupos en backend y vuelve a validarse antes de responder.</p></div>${renderHealth(ragConfigured ? 'unknown' : 'not_configured')}</div>
          <form id="rag-search-form" class="form-grid mt-16">
            <label class="span-9">Consulta
              <input id="rag-query" name="query" type="search" minlength="2" maxlength="2000" autocomplete="off" placeholder="Ej. requisitos vigentes para una cobertura…" required ${ragConfigured ? '' : 'disabled'}>
            </label>
            <label class="span-3">Resultados
              <select id="rag-top-k" name="topK" ${ragConfigured ? '' : 'disabled'}>
                <option value="5">5</option>
                <option value="8" selected>8</option>
                <option value="12">12</option>
                <option value="20">20</option>
              </select>
            </label>
            <div class="span-12 toolbar"><button class="primary" type="submit" ${ragConfigured ? '' : 'disabled'}>Buscar en RAG</button><span id="rag-search-state" class="muted">${stateText}</span></div>
          </form>
          <div id="rag-results" class="mt-16"></div>
        </article>

        <article class="panel span-5">
          <div class="section-heading"><div><h2>Pipeline</h2><p>Estado de implementación, no marketing.</p></div></div>
          <div class="timeline mt-16">
            ${[
              ['R2 / documentos originales', 'Base de evidencia preparada; ingestión RAG específica se conecta después'],
              ['Parser / OCR', 'Adapter/job especializado pendiente'],
              ['Chunking', 'Contrato RAG preparado; pipeline de ingestión pendiente'],
              ['Embeddings', ragConfigured ? 'Endpoint/model server-side declarado' : 'Endpoint/model no configurado'],
              ['Supabase pgvector', ragConfigured ? 'Adapter + RPC contract implementados' : 'Adapter implementado; credenciales/schema pendientes'],
              ['Retrieval con ACL', 'Implementado con doble validación de scope'],
              ['Reranking', 'Puerto disponible; adapter Modal/HF pendiente'],
              ['Contexto + citas', 'Citas estructuradas implementadas'],
            ].map(([name, state]) => `<div class="timeline-item"><span class="timeline-dot"></span><div class="timeline-content"><strong>${escapeText(name)}</strong><span>${escapeText(state)}</span></div></div>`).join('')}
          </div>
        </article>
      </section>
    </div>`;

    const form = ctx.root.querySelector<HTMLFormElement>('#rag-search-form');
    const queryInput = ctx.root.querySelector<HTMLInputElement>('#rag-query');
    const topKInput = ctx.root.querySelector<HTMLSelectElement>('#rag-top-k');
    const state = ctx.root.querySelector<HTMLElement>('#rag-search-state');
    const results = ctx.root.querySelector<HTMLElement>('#rag-results');

    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!queryInput || !topKInput || !state || !results || !ragConfigured) return;
      const query = queryInput.value.trim();
      if (query.length < 2) return;
      const topK = Number(topKInput.value);
      const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (submit) submit.disabled = true;
      state.textContent = 'Consultando RAG…';
      results.innerHTML = renderLoading('Recuperando chunks autorizados…');
      try {
        const response = await api.post<RagSearchResponse>('/v1/rag/search', { query, topK });
        results.innerHTML = renderResults(response);
        state.textContent = `${response.items.length} resultado(s) · consulta auditada por hash, no por texto.`;
      } catch (error) {
        results.innerHTML = renderAlert(ragErrorMessage(error), 'danger');
        state.textContent = 'Consulta no completada.';
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  } catch (error) {
    ctx.root.innerHTML = renderPageError(error);
  }
}
