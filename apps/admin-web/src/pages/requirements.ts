import { api } from '../core/api-client.js';
import type { PageContext } from '../core/page-context.js';
import type { ListResponse } from '../core/types.js';
import { renderPageError } from '../core/page-utils.js';
import { renderAlert, renderLoading, renderTable } from '../components/ui.js';

type Row = Record<string, unknown>;

export async function renderRequirements(ctx: PageContext): Promise<void> {
  ctx.setTitle('Requisitos', 'Catálogo vigente usado por la evaluación de elegibilidad');
  ctx.root.innerHTML = renderLoading('Cargando requisitos…');
  try {
    const requirements = (await api.get<ListResponse<Row>>('/v1/reference/requirements')).items;
    ctx.root.innerHTML = `<div class="page-stack">
      ${renderAlert('Esta pantalla consulta el catálogo. La elegibilidad final se calcula en el backend para cada concurso y no en el navegador.', 'info')}
      <section class="panel"><div class="section-heading"><div><h2>Catálogo activo</h2><p>${requirements.length} requisitos visibles.</p></div></div>
        ${renderTable(requirements, [
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Requisito' },
          { key: 'requirement_type', label: 'Tipo' },
          { key: 'validity_days', label: 'Vigencia (días)' },
          { key: 'active', label: 'Activo' },
          { key: 'version', label: 'Versión' },
        ])}
      </section>
    </div>`;
  } catch (error) {
    ctx.root.innerHTML = renderPageError(error);
  }
}
