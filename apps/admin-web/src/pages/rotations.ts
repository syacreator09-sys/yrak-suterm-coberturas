import { api } from '../core/api-client.js';
import type { PageContext } from '../core/page-context.js';
import type { ListResponse } from '../core/types.js';
import { optionsHtml, renderPageError } from '../core/page-utils.js';
import { escapeText } from '../core/security.js';
import { renderField, renderLoading, renderTable, showToast } from '../components/ui.js';

type Row = Record<string, unknown>;

export async function renderRotations(ctx: PageContext): Promise<void> {
  ctx.setTitle('Rotaciones 1–5', 'Colas visibles por grupo y transición; la selección sigue en el motor');
  ctx.root.innerHTML = renderLoading('Cargando grupos autorizados…');
  try {
    const groups = (await api.get<ListResponse<Row>>('/v1/reference/groups')).items;
    ctx.root.innerHTML = `<div class="page-stack">
      <section class="panel"><div class="section-heading"><div><h2>Consultar cola</h2><p>Esta vista es read-only. No mueve posiciones ni selecciona trabajadores.</p></div></div>
        <div class="form-grid" style="margin-top:14px">
          ${renderField('Grupo', `<select id="rotation-group"><option value="">Seleccione</option>${optionsHtml(groups)}</select>`)}
          ${renderField('Pool / transición', '<select id="rotation-pool" disabled><option value="">Seleccione grupo primero</option></select>')}
        </div>
      </section>
      <section class="panel"><div id="rotation-summary" class="alert alert-info">Selecciona un grupo y un pool para ver la cola.</div><div id="rotation-queue"></div></section>
    </div>`;

    const group = ctx.root.querySelector<HTMLSelectElement>('#rotation-group')!;
    const pool = ctx.root.querySelector<HTMLSelectElement>('#rotation-pool')!;
    const queue = ctx.root.querySelector<HTMLElement>('#rotation-queue')!;
    const summary = ctx.root.querySelector<HTMLElement>('#rotation-summary')!;

    group.addEventListener('change', async () => {
      pool.disabled = true;
      queue.innerHTML = '';
      try {
        const rows = group.value
          ? (await api.get<ListResponse<Row>>(`/v1/reference/groups/${encodeURIComponent(group.value)}/rotation-pools`)).items
          : [];
        pool.innerHTML = `<option value="">Seleccione</option>${rows.map((row) => {
          const id = escapeText(row.id ?? '');
          const source = escapeText(row.source_level_id ?? '—');
          const target = escapeText(row.target_level_id ?? '—');
          return `<option value="${id}">${source} → ${target}</option>`;
        }).join('')}`;
        pool.disabled = false;
        summary.textContent = rows.length ? `${rows.length} pools visibles para este grupo.` : 'No hay pools activos para este grupo.';
      } catch (error) {
        pool.innerHTML = '<option value="">Error al cargar pools</option>';
        showToast(error instanceof Error ? error.message : error, 'danger');
      }
    });

    pool.addEventListener('change', async () => {
      queue.innerHTML = renderLoading('Cargando cola…');
      if (!pool.value) {
        queue.innerHTML = '';
        return;
      }
      try {
        const rows = (await api.get<ListResponse<Row>>(`/v1/reference/rotation-pools/${encodeURIComponent(pool.value)}/queue`)).items;
        summary.textContent = `${rows.length} trabajadores en la cola. El orden mostrado proviene de la base de datos; esta vista no lo modifica.`;
        queue.innerHTML = renderTable(rows, [
          { key: 'queue_position', label: 'Posición' },
          { key: 'employee_number', label: 'Número' },
          { key: 'name', label: 'Trabajador' },
          { key: 'status', label: 'Disponibilidad' },
          { key: 'last_coverage_at', label: 'Última cobertura' },
          { key: 'times_selected', label: 'Veces seleccionado' },
        ], { empty: 'La cola está vacía.' });
      } catch (error) {
        queue.innerHTML = renderPageError(error);
      }
    });
  } catch (error) {
    ctx.root.innerHTML = renderPageError(error);
  }
}
