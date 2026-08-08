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
      ${renderAlert('La extracción de IA crea un borrador. Ningún borrador se convierte en cobertura hasta que una persona autorizada lo revise y lo consuma explícitamente.', 'warning')}
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
        <article class="panel span-4"><h2>Consumir borrador revisado</h2><form id="intake-consume-form">
          ${renderField('Draft ID', '<input name="draftId" required>')}
          ${renderField('Grupo', `<select name="groupId" id="intake-group" required><option value="">Seleccione</option>${optionsHtml(groups)}</select>`)}
          ${renderField('Nivel destino', '<select name="targetLevelId" id="intake-level" required><option value="">Seleccione grupo primero</option></select>')}
          <div class="form-grid">${renderField('Inicio', '<input name="startDate" type="date" required>')}${renderField('Fin', '<input name="endDate" type="date" required>')}</div>
          ${renderField('Motivo', '<input name="reason">')}
          <div class="form-actions"><button class="primary" type="submit">Crear cobertura desde borrador</button></div>
        </form></article>
      </section>
      <section class="panel"><div class="section-heading"><div><h2>Borradores</h2><p>${drafts.length} registros recientes.</p></div></div>
        ${renderTable(drafts, [
          { key: 'id', label: 'Draft ID' },
          { key: 'source_type', label: 'Origen' },
          { key: 'confidence', label: 'Confianza' },
          { key: 'status', label: 'Estado' },
          { key: 'created_at', label: 'Creado' },
        ])}
      </section>
      <section id="document-output"></section>
    </div>`;

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

    ctx.root.querySelector<HTMLFormElement>('#intake-text-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      await withBusy(button, async () => {
        const content = String(new FormData(form).get('content') ?? '').trim();
        const result = await api.post('/v1/intake/extract-text', { content });
        ctx.root.querySelector<HTMLElement>('#document-output')!.innerHTML = `<article class="panel"><h2>Borrador generado</h2>${renderJson(result)}</article>`;
        showToast('Borrador creado para revisión humana.', 'success');
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });

    ctx.root.querySelector<HTMLFormElement>('#intake-file-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      await withBusy(button, async () => {
        const fd = new FormData(form);
        const file = fd.get('file');
        if (!(file instanceof File)) throw new Error('FILE_REQUIRED');
        const entityId = crypto.randomUUID();
        const uploadForm = new FormData();
        uploadForm.set('file', file);
        const uploaded = await api.upload<{ id: string }>(`/v1/attachments?entityType=INTAKE&entityId=${encodeURIComponent(entityId)}`, uploadForm);
        const processed = await api.post(`/v1/intake/attachments/${encodeURIComponent(uploaded.id)}/process`);
        ctx.root.querySelector<HTMLElement>('#document-output')!.innerHTML = `<article class="panel"><h2>Resultado de extracción</h2>${renderJson(processed)}</article>`;
        showToast('Archivo procesado y convertido en borrador.', 'success');
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });

    ctx.root.querySelector<HTMLFormElement>('#intake-consume-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      await withBusy(button, async () => {
        const fd = new FormData(form);
        const draftId = String(fd.get('draftId') ?? '').trim();
        const result = await api.post(`/v1/intake/drafts/${encodeURIComponent(draftId)}/consume`, {
          groupId: String(fd.get('groupId') ?? ''),
          targetLevelId: String(fd.get('targetLevelId') ?? ''),
          startDate: String(fd.get('startDate') ?? ''),
          endDate: String(fd.get('endDate') ?? ''),
          reason: nullableText(String(fd.get('reason') ?? '')),
        });
        ctx.root.querySelector<HTMLElement>('#document-output')!.innerHTML = `<article class="panel"><h2>Cobertura creada desde borrador revisado</h2>${renderJson(result)}</article>`;
        showToast('Borrador consumido.', 'success');
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });
  } catch (error) {
    ctx.root.innerHTML = renderPageError(error);
  }
}
