import { api } from '../core/api-client.js';
import type { PageContext } from '../core/page-context.js';
import type { ListResponse } from '../core/types.js';
import { renderPageError } from '../core/page-utils.js';
import { renderAlert, renderField, renderLoading, renderTable, showToast, withBusy } from '../components/ui.js';

type Row = Record<string, unknown>;

export async function renderAudit(ctx: PageContext): Promise<void> {
  ctx.setTitle('Auditoría', 'Eventos append-only consultados por entidad');
  ctx.root.innerHTML = `<div class="page-stack">
    ${renderAlert('Esta pantalla es de sólo lectura. No existe acción para borrar o modificar eventos de auditoría.', 'info')}
    <section class="panel"><h2>Consultar historial</h2><form id="audit-form" class="form-grid">
      ${renderField('Entity Type', '<input name="entityType" placeholder="COVERAGE_CASE" required>')}
      ${renderField('Entity ID', '<input name="entityId" required>')}
      <div class="form-actions"><button class="primary" type="submit">Consultar</button></div>
    </form></section>
    <section class="panel"><div id="audit-output">${renderLoading('Ingresa una entidad para consultar su historial.')}</div></section>
  </div>`;

  ctx.root.querySelector<HTMLFormElement>('#audit-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const output = ctx.root.querySelector<HTMLElement>('#audit-output')!;
    await withBusy(button, async () => {
      const fd = new FormData(form);
      const entityType = String(fd.get('entityType') ?? '').trim();
      const entityId = String(fd.get('entityId') ?? '').trim();
      output.innerHTML = renderLoading('Consultando auditoría…');
      const rows = (await api.get<ListResponse<Row>>(`/v1/audit/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`)).items;
      output.innerHTML = renderTable(rows, [
        { key: 'created_at', label: 'Fecha' },
        { key: 'actor_id', label: 'Actor' },
        { key: 'actor_role', label: 'Rol' },
        { key: 'action', label: 'Acción' },
        { key: 'rule_applied', label: 'Regla' },
        { key: 'reason', label: 'Razón' },
        { key: 'correlation_id', label: 'Correlation ID' },
        { key: 'previous_value_json', label: 'Anterior' },
        { key: 'new_value_json', label: 'Nuevo' },
      ], { empty: 'No hay eventos para esta entidad.' });
    }).catch((error) => {
      output.innerHTML = renderPageError(error);
      showToast(error instanceof Error ? error.message : error, 'danger');
    });
  });
}
