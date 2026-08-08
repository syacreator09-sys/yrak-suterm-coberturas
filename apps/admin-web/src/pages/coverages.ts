import { api } from '../core/api-client.js';
import type { PageContext } from '../core/page-context.js';
import type { ListResponse } from '../core/types.js';
import { nullableText, optionsHtml, renderPageError } from '../core/page-utils.js';
import { escapeText } from '../core/security.js';
import { confirmCriticalAction, renderField, renderJson, renderLoading, renderTable, showToast, withBusy } from '../components/ui.js';

type Row = Record<string, unknown>;

type CoverageDetail = {
  coverage: Row;
  assignments: Row[];
  candidates: Row[];
  children: Row[];
};

function isRole(role: string, roles: readonly string[]): boolean {
  return roles.includes(role);
}

export async function renderCoverages(ctx: PageContext): Promise<void> {
  ctx.setTitle('Coberturas', 'Expedientes temporales, preview, asignación y cierre');
  ctx.root.innerHTML = renderLoading('Cargando coberturas…');
  const role = ctx.session.user.role;
  const canCreate = isRole(role, ['ADMIN', 'HR', 'SUPERVISOR', 'OPERATOR']);
  const canSelect = canCreate;
  const canApprove = isRole(role, ['ADMIN', 'HR', 'SUPERVISOR']);

  try {
    const [coverages, groups] = await Promise.all([
      api.get<ListResponse<Row>>('/v1/coverage-cases').then((x) => x.items),
      canCreate ? api.get<ListResponse<Row>>('/v1/reference/groups').then((x) => x.items) : Promise.resolve([] as Row[]),
    ]);
    ctx.root.innerHTML = `<div class="page-stack">
      ${canCreate ? `<section class="page-grid">
        <article class="panel span-5"><h2>Nueva cobertura</h2><form id="coverage-form">
          ${renderField('Grupo', `<select name="groupId" id="coverage-group" required><option value="">Seleccione</option>${optionsHtml(groups)}</select>`)}
          ${renderField('Nivel destino', '<select name="targetLevelId" id="coverage-level" required><option value="">Seleccione grupo primero</option></select>')}
          <div class="form-grid">
            ${renderField('Inicio', '<input name="startDate" type="date" required>')}
            ${renderField('Fin', '<input name="endDate" type="date" required>')}
          </div>
          ${renderField('Motivo', '<input name="reason">')}
          <div class="form-actions"><button class="secondary" id="preview-button" type="button">Previsualizar</button><button class="primary" type="submit">Crear expediente</button></div>
        </form><div id="coverage-preview"></div></article>
        <article class="panel span-7"><h2>Abrir expediente</h2><form id="coverage-load-form" class="toolbar"><div class="toolbar-group"><input name="caseId" placeholder="Coverage Case ID" required><button class="primary" type="submit">Cargar</button></div></form><div id="coverage-detail" class="page-stack"></div></article>
      </section>` : `<section class="panel"><h2>Abrir expediente</h2><form id="coverage-load-form" class="toolbar"><div class="toolbar-group"><input name="caseId" placeholder="Coverage Case ID" required><button class="primary" type="submit">Cargar</button></div></form><div id="coverage-detail" class="page-stack"></div></section>`}
      <section class="panel"><div class="section-heading"><div><h2>Expedientes</h2><p>${coverages.length} coberturas visibles.</p></div></div>${renderTable(coverages, [
        { key: 'id', label: 'Expediente' },
        { key: 'group_id', label: 'Grupo' },
        { key: 'target_level_id', label: 'Nivel destino' },
        { key: 'starts_on', label: 'Inicio' },
        { key: 'ends_on', label: 'Fin' },
        { key: 'effective_days', label: 'Días' },
        { key: 'process_type', label: 'Proceso' },
        { key: 'status', label: 'Estado' },
      ])}</section>
    </div>`;

    const group = ctx.root.querySelector<HTMLSelectElement>('#coverage-group');
    const level = ctx.root.querySelector<HTMLSelectElement>('#coverage-level');
    if (group && level) {
      group.addEventListener('change', async () => {
        level.disabled = true;
        try {
          const rows = group.value ? (await api.get<ListResponse<Row>>(`/v1/reference/groups/${encodeURIComponent(group.value)}/levels`)).items : [];
          level.innerHTML = `<option value="">Seleccione</option>${optionsHtml(rows)}`;
        } catch (error) {
          level.innerHTML = '<option value="">Error al cargar niveles</option>';
          showToast(error instanceof Error ? error.message : error, 'danger');
        } finally {
          level.disabled = false;
        }
      });
    }

    const form = ctx.root.querySelector<HTMLFormElement>('#coverage-form');
    const preview = ctx.root.querySelector<HTMLButtonElement>('#preview-button');
    if (form && preview) {
      preview.addEventListener('click', async () => {
        await withBusy(preview, async () => {
          const fd = new FormData(form);
          const data = await api.post('/v1/coverage-cases/preview', {
            groupId: String(fd.get('groupId') ?? ''),
            startDate: String(fd.get('startDate') ?? ''),
            endDate: String(fd.get('endDate') ?? ''),
          });
          const target = ctx.root.querySelector<HTMLElement>('#coverage-preview')!;
          target.innerHTML = `<div class="alert alert-info mt-12">Preview calculado por el motor. Crear el expediente no cambia estas reglas.</div>${renderJson(data)}`;
        }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
      });

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
        await withBusy(button, async () => {
          const fd = new FormData(form);
          const result = await api.post('/v1/coverage-cases', {
            groupId: String(fd.get('groupId') ?? ''),
            targetLevelId: String(fd.get('targetLevelId') ?? ''),
            startDate: String(fd.get('startDate') ?? ''),
            endDate: String(fd.get('endDate') ?? ''),
            reason: nullableText(String(fd.get('reason') ?? '')),
          }, { headers: { 'idempotency-key': crypto.randomUUID() } });
          showToast('Cobertura creada.', 'success');
          const id = (result as { id?: string }).id;
          if (id) await renderCoverageDetail(ctx, id, { canSelect, canApprove });
        }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
      });
    }

    ctx.root.querySelector<HTMLFormElement>('#coverage-load-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget as HTMLFormElement);
      const id = String(fd.get('caseId') ?? '').trim();
      if (!id) return;
      await renderCoverageDetail(ctx, id, { canSelect, canApprove });
    });
  } catch (error) {
    ctx.root.innerHTML = renderPageError(error);
  }
}

async function renderCoverageDetail(
  ctx: PageContext,
  id: string,
  permissions: { canSelect: boolean; canApprove: boolean },
): Promise<void> {
  const target = ctx.root.querySelector<HTMLElement>('#coverage-detail');
  if (!target) return;
  target.innerHTML = renderLoading('Cargando expediente…');
  try {
    const detail = await api.get<CoverageDetail>(`/v1/coverage-cases/${encodeURIComponent(id)}`);
    const processType = String(detail.coverage.process_type ?? '');
    const status = String(detail.coverage.status ?? '');
    const canSelectRotation = permissions.canSelect && processType === 'ROTATION' && !['COMPLETED', 'CANCELLED'].includes(status);
    const canApproveRotation = permissions.canApprove && processType === 'ROTATION' && !['COMPLETED', 'CANCELLED'].includes(status);
    const canCloseOrCancel = permissions.canApprove && !['COMPLETED', 'CANCELLED'].includes(status);

    target.innerHTML = `<div class="panel"><div class="section-heading"><div><h2>Expediente</h2><p>${escapeText(detail.coverage.id ?? id)}</p></div></div>
      <dl class="key-value">
        <dt>Estado</dt><dd>${escapeText(status || '—')}</dd>
        <dt>Proceso</dt><dd>${escapeText(processType || '—')}</dd>
        <dt>Días efectivos</dt><dd>${escapeText(detail.coverage.effective_days ?? '—')}</dd>
        <dt>Inicio</dt><dd>${escapeText(detail.coverage.starts_on ?? '—')}</dd>
        <dt>Fin</dt><dd>${escapeText(detail.coverage.ends_on ?? '—')}</dd>
      </dl>
      <div class="actions">
        ${canSelectRotation ? '<button class="secondary" id="coverage-select" type="button">Seleccionar rotación</button>' : ''}
        ${canApproveRotation ? '<button class="primary" id="coverage-approve" type="button">Aprobar rotación</button>' : ''}
        ${canCloseOrCancel ? '<button class="secondary" id="coverage-complete" type="button">Cerrar / regresar a base</button><label class="field m-0"><span class="field-label">Cancelación iniciada consume turno</span><input id="cancel-consumes-turn" class="w-auto" type="checkbox"></label><button class="danger" id="coverage-cancel" type="button">Cancelar</button>' : ''}
      </div></div>
      <div class="panel"><h3>Asignaciones</h3>${renderTable(detail.assignments, [
        { key: 'id', label: 'ID' }, { key: 'employee_id', label: 'Trabajador' }, { key: 'base_level_id', label: 'Base' }, { key: 'target_level_id', label: 'Destino' }, { key: 'status', label: 'Estado' },
      ])}</div>
      <div class="panel"><h3>Evaluaciones de candidatos</h3>${renderTable(detail.candidates, [
        { key: 'employee_id', label: 'Trabajador' }, { key: 'eligible', label: 'Elegible' }, { key: 'reason', label: 'Motivo' }, { key: 'created_at', label: 'Fecha' },
      ])}</div>
      ${detail.children.length ? `<div class="panel"><h3>Cascadas relacionadas</h3>${renderTable(detail.children, [
        { key: 'id', label: 'Expediente' }, { key: 'target_level_id', label: 'Destino' }, { key: 'process_type', label: 'Proceso' }, { key: 'status', label: 'Estado' }, { key: 'chain_order', label: 'Cadena' },
      ])}</div>` : ''}`;

    const refresh = () => renderCoverageDetail(ctx, id, permissions);
    target.querySelector<HTMLButtonElement>('#coverage-select')?.addEventListener('click', async (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      await withBusy(button, async () => {
        await api.post(`/v1/coverage-cases/${encodeURIComponent(id)}/rotation/select`);
        showToast('Selección calculada por el motor.', 'success');
        await refresh();
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });
    target.querySelector<HTMLButtonElement>('#coverage-approve')?.addEventListener('click', async (event) => {
      if (!await confirmCriticalAction({ title: 'Aprobar rotación', message: 'Confirma la aprobación del expediente. La API validará estado, permisos y reglas antes de realizar cualquier cambio.', confirmLabel: 'Aprobar' })) return;
      const button = event.currentTarget as HTMLButtonElement;
      await withBusy(button, async () => {
        await api.post(`/v1/coverage-cases/${encodeURIComponent(id)}/approve`);
        showToast('Cobertura aprobada.', 'success');
        await refresh();
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });
    target.querySelector<HTMLButtonElement>('#coverage-complete')?.addEventListener('click', async (event) => {
      if (!await confirmCriticalAction({ title: 'Cerrar cobertura', message: 'Confirma el cierre. El motor devolverá la asignación temporal al nivel base según las reglas vigentes.', confirmLabel: 'Cerrar cobertura' })) return;
      const button = event.currentTarget as HTMLButtonElement;
      await withBusy(button, async () => {
        await api.post(`/v1/coverage-cases/${encodeURIComponent(id)}/complete`);
        showToast('Cobertura cerrada.', 'success');
        await refresh();
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });
    target.querySelector<HTMLButtonElement>('#coverage-cancel')?.addEventListener('click', async (event) => {
      const reason = window.prompt('Motivo de cancelación');
      if (!reason?.trim()) return;
      if (!await confirmCriticalAction({ title: 'Cancelar cobertura', message: 'Esta acción modifica el estado del expediente. Confirma que deseas continuar.', confirmLabel: 'Cancelar cobertura', danger: true })) return;
      const button = event.currentTarget as HTMLButtonElement;
      const consumes = target.querySelector<HTMLInputElement>('#cancel-consumes-turn')?.checked ?? false;
      await withBusy(button, async () => {
        await api.post(`/v1/coverage-cases/${encodeURIComponent(id)}/cancel`, { reason: reason.trim(), activeRotationConsumesTurn: consumes });
        showToast('Cobertura cancelada.', 'success');
        await refresh();
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });
  } catch (error) {
    target.innerHTML = renderPageError(error);
  }
}
