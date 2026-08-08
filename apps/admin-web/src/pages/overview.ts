import { api, ApiError } from '../core/api-client.js';
import type { PageContext } from '../core/page-context.js';
import type { ListResponse } from '../core/types.js';
import { renderAlert, renderLoading, renderStat, renderTable } from '../components/ui.js';
import { buildOverviewMetrics, type CoverageSummaryRow } from './overview-model.js';

type Row = Record<string, unknown>;

async function optionalList(path: string): Promise<Row[] | undefined> {
  try {
    return (await api.get<ListResponse<Row>>(path)).items;
  } catch (error) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return undefined;
    throw error;
  }
}

export async function renderOverview(ctx: PageContext): Promise<void> {
  ctx.setTitle('Overview', 'Estado operativo y disponibilidad de los módulos principales');
  ctx.root.innerHTML = renderLoading('Cargando resumen operativo…');

  try {
    const [employees, groups, coverages] = await Promise.all([
      optionalList('/v1/employees'),
      optionalList('/v1/config/groups'),
      optionalList('/v1/coverage-cases'),
    ]);
    const coverageRows = coverages as CoverageSummaryRow[] | undefined;
    const metrics = buildOverviewMetrics({ employees, groups, coverages: coverageRows });
    const latest = (coverages ?? []).slice(0, 10);

    ctx.setGlobalStatus('API conectada', 'success');
    ctx.root.innerHTML = `<div class="page-stack">
      <section class="stats-grid">
        ${renderStat('Personal', metrics.employees ?? '—', metrics.employees === null ? 'Sin permiso o sin verificar' : 'Registros visibles')}
        ${renderStat('Coberturas', metrics.coverages ?? '—', 'Expedientes visibles')}
        ${renderStat('Activas / programadas', metrics.activeOrScheduled ?? '—', 'Requieren seguimiento')}
        ${renderStat('Concursos 6+', metrics.competitions ?? '—', 'Procesos de concurso')}
      </section>
      <section class="page-grid">
        <article class="panel span-8">
          <div class="section-heading"><div><h2>Últimas coberturas</h2><p>Actividad reciente registrada por el motor operativo.</p></div></div>
          ${renderTable(latest, [
            { key: 'id', label: 'Expediente' },
            { key: 'target_level_id', label: 'Nivel destino' },
            { key: 'effective_days', label: 'Días' },
            { key: 'process_type', label: 'Proceso' },
            { key: 'status', label: 'Estado' },
          ], { empty: 'No hay coberturas visibles.' })}
        </article>
        <aside class="panel span-4">
          <h2>Estado del Control Center</h2>
          <div class="timeline">
            <div class="timeline-item"><span class="timeline-dot"></span><div class="timeline-content"><strong>API</strong><span>Sesión autenticada y API accesible.</span></div></div>
            <div class="timeline-item"><span class="timeline-dot"></span><div class="timeline-content"><strong>Reglas laborales</strong><span>Las decisiones continúan en el motor determinista; el Dashboard no las replica.</span></div></div>
            <div class="timeline-item"><span class="timeline-dot"></span><div class="timeline-content"><strong>RAG / integraciones</strong><span>Se mostrarán como no configuradas hasta conectar y verificar cada servicio.</span></div></div>
          </div>
        </aside>
      </section>
    </div>`;
  } catch (error) {
    ctx.setGlobalStatus('API degradada', 'warning');
    const correlationId = error instanceof ApiError ? error.correlationId : undefined;
    ctx.root.innerHTML = renderAlert(error instanceof Error ? error.message : error, 'danger', correlationId);
  }
}
