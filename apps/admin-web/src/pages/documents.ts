import { api } from '../core/api-client.js';
import type { PageContext } from '../core/page-context.js';
import type { ListResponse } from '../core/types.js';
import { nullableText, optionsHtml, renderPageError } from '../core/page-utils.js';
import { renderAlert, renderField, renderJson, renderLoading, renderTable, showToast, withBusy } from '../components/ui.js';

type Row = Record<string, unknown>;

export async function renderDocuments(ctx: PageContext): Promise<void> {
  ctx.setTitle('Documentos', 'Ingreso de evidencia y borradores asistidos por IA');
  ctx.root.innerHTML = renderLoading('Cargando borradores…');
  try {
    const [drafts, groups] = await Promise.all([
      api.get<ListResponse<Row>>('/v1/intake/drafts').then((x) => x.items),
      api.get<ListResponse<Row>>('/v1/reference/groups').then((x) => x.items),
    ]);
    ctx.root.innerHTML = `<div class="page-stack">
      ${renderAlert('La extracción de IA crea un borrador. La UI exige abrir el borrador y mostrar su extracción antes de habilitar su consumo como cobertura.', 'warning')}
      <section class="page-grid">
        <article class="panel span-4"><h2>Extraer desde texto</h2><form id="intake-text-form">
          ${renderField('Mensaje / solicitud', '<textarea name="content" placeholder="Pegue únicamente contenido autorizado para pruebas o revisión." required></textarea>')}
          <div class="form-actions"><button class="primary" type="submit">Crear borrador</button></div>
        </form></article>
        <article class="panel span-4"><h2>Subir evidencia</h2><form id="intake-file-form">
          ${renderField('Archivo', '<input name="file" id="intake-file" type="file" required>', 'El contenido nunca se inserta como HTML en el Dashboard.')}
          <div id="file-meta" class="metric-note">Sin archivo seleccionado.</div>
          <div class="form-actions"><button class="primary" type="submit">Subir y procesar</button></div>
        </form></article>
        <article class="panel span-4"><h2>Revisar borrador</h2><form id="intake-review-form">
          ${renderField('Draft ID', '<input name="draftId" required>')}
          <div class="form-actions"><button class="secondary" type="submit">Abrir extracción</button></div>
        </form><div id="draft-review-output"></div></article>
      </section>
      <section class="page-grid">
        <article class="panel span-5"><h2>Consumir borrador revisado</h2><form id="intake-consume-form">
          ${renderField('Draft ID revisado', '<input name="draftId" id="consume-draft-id" readonly required>', 'Sólo se completa al abrir el borrador con el panel de revisión.')}
          ${renderField('Grupo', `<select name="groupId" id="intake-group" required><option value="">Seleccione</option>${optionsHtml(groups)}</select>`)}
          ${renderField('Nivel destino', '<select name="targetLevelId" id="intake-level" required><option value="">Seleccione grupo primero</option></select>')}
          <div class="form-grid">${renderField('Inicio', '<input name="startDate" type="date" required>')}${renderField('Fin', '<input name="endDate" type="date" required>')}</div>
          ${renderField('Motivo', '<input name="reason">')}
          <div class="form-actions"><button class="primary" id="consume-draft-button" type="submit" disabled>Crear cobertura desde borrador revisado</button></div>
        </form></article>
        <article class="panel span-7"><div class="section-heading"><div><h2>Borradores visibles</h2><p>${drafts.length} registros. Los operativos sólo ven los creados por ellos.</p></div></div>
          ${renderTable(drafts, [
            { key: 'id', label: 'Draft ID' },
            { key: 'source_type', label: 'Origen' },
            { key: 'confidence', label: 'Confianza' },
            { key: 'status', label: 'Estado' },
            { key: 'created_by', label: 'Creado por' },
            { key: 'created_at', label: 'Creado' },
          ])}
        </article>
      </section>
      <section id="document-output"></section>
    </div>`;

    let reviewedDraftId: string | null = null;
    const consumeDraftId = ctx.root.querySelector<HTMLInputElement>('#consume-draft-id')!;
    const consumeButton = ctx.root.querySelector<HTMLButtonElement>('#consume-draft-button')!;
    const reviewOutput = ctx.root.querySelector<HTMLElement>('#draft-review-output')!;

    const clearReview = () => {
      reviewedDraftId = null;
      consumeDraftId.value = '';
      consumeButton.disabled = true;
      reviewOutput.innerHTML = '';
    };

    const fileInput = ctx.root.querySelector<HTMLInputElement>('#intake-file');
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      const meta = ctx.root.querySelector<HTMLElement>('#file-meta')!;
      meta.textContent = file ? `${file.name} · ${file.type || 'tipo no informado'} · ${file.size.toLocaleString()} bytes` : 'Sin archivo seleccionado.';
    });

    const group = ctx.root.querySelector<HTMLSelectElement>('#intake-group')!;
    const level = ctx.root.querySelector<HTMLSelectElement>('#intake-level')!;
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

    ctx.root.querySelector<HTMLFormElement>('#intake-review-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      clearReview();
      await withBusy(button, async () => {
        const draftId = String(new FormData(form).get('draftId') ?? '').trim();
        const detail = await api.get<Row>(`/v1/intake/drafts/${encodeURIComponent(draftId)}`);
        reviewOutput.innerHTML = `<div class="mt-12">${renderAlert('Revisa fechas, grupo/nivel sugeridos y cualquier dato extraído antes de continuar.', 'warning')}${renderJson(detail)}</div>`;
        reviewedDraftId = draftId;
        consumeDraftId.value = draftId;
        consumeButton.disabled = false;
        showToast('Borrador abierto para revisión.', 'success');
      }).catch((error) => {
        clearReview();
        showToast(error instanceof Error ? error.message : error, 'danger');
      });
    });

    ctx.root.querySelector<HTMLFormElement>('#intake-text-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      clearReview();
      await withBusy(button, async () => {
        const content = String(new FormData(form).get('content') ?? '').trim();
        const result = await api.post<{ id: string; status: string; extracted: unknown }>('/v1/intake/extract-text', { content });
        ctx.root.querySelector<HTMLElement>('#document-output')!.innerHTML = `<article class="panel"><h2>Borrador generado</h2>${renderJson(result)}${renderAlert(`Abre el Draft ID ${result.id} en “Revisar borrador” antes de consumirlo.`, 'info')}</article>`;
        showToast('Borrador creado. Falta revisión explícita.', 'success');
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });

    ctx.root.querySelector<HTMLFormElement>('#intake-file-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      clearReview();
      await withBusy(button, async () => {
        const fd = new FormData(form);
        const file = fd.get('file');
        if (!(file instanceof File)) throw new Error('FILE_REQUIRED');
        const entityId = crypto.randomUUID();
        const uploadForm = new FormData();
        uploadForm.set('file', file);
        const uploaded = await api.upload<{ id: string }>(`/v1/attachments?entityType=INTAKE&entityId=${encodeURIComponent(entityId)}`, uploadForm);
        const processed = await api.post<{ id: string; status: string; extracted: unknown }>(`/v1/intake/attachments/${encodeURIComponent(uploaded.id)}/process`);
        ctx.root.querySelector<HTMLElement>('#document-output')!.innerHTML = `<article class="panel"><h2>Resultado de extracción</h2>${renderJson(processed)}${renderAlert(`Abre el Draft ID ${processed.id} en “Revisar borrador” antes de consumirlo.`, 'info')}</article>`;
        showToast('Archivo procesado. Falta revisión explícita.', 'success');
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });

    ctx.root.querySelector<HTMLFormElement>('#intake-consume-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      if (!reviewedDraftId || consumeDraftId.value !== reviewedDraftId) {
        showToast('Debes abrir y revisar el borrador antes de consumirlo.', 'warning');
        return;
      }
      await withBusy(consumeButton, async () => {
        const fd = new FormData(form);
        const result = await api.post(`/v1/intake/drafts/${encodeURIComponent(reviewedDraftId!)}/consume`, {
          groupId: String(fd.get('groupId') ?? ''),
          targetLevelId: String(fd.get('targetLevelId') ?? ''),
          startDate: String(fd.get('startDate') ?? ''),
          endDate: String(fd.get('endDate') ?? ''),
          reason: nullableText(String(fd.get('reason') ?? '')),
        });
        ctx.root.querySelector<HTMLElement>('#document-output')!.innerHTML = `<article class="panel"><h2>Cobertura creada desde borrador revisado</h2>${renderJson(result)}</article>`;
        showToast('Borrador consumido.', 'success');
        clearReview();
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });
  } catch (error) {
    ctx.root.innerHTML = renderPageError(error);
  }
}
