import { api } from '../core/api-client.js';
import type { PageContext } from '../core/page-context.js';
import type { ListResponse } from '../core/types.js';
import { optionsHtml, nullableText, numberOrNull, renderPageError } from '../core/page-utils.js';
import { renderField, renderLoading, renderTable, showToast, withBusy } from '../components/ui.js';

type Row = Record<string, unknown>;

export async function renderEmployees(ctx: PageContext): Promise<void> {
  ctx.setTitle('Personal', 'Directorio, nivel base, requisitos e indisponibilidades');
  ctx.root.innerHTML = renderLoading('Cargando personal…');
  const role = ctx.session.user.role;
  const canAdmin = role === 'ADMIN' || role === 'HR';
  const canUnavailable = canAdmin || role === 'SUPERVISOR';

  try {
    const employees = (await api.get<ListResponse<Row>>('/v1/employees')).items;
    const [groups, requirements] = canAdmin
      ? await Promise.all([
          api.get<ListResponse<Row>>('/v1/config/groups').then((x) => x.items),
          api.get<ListResponse<Row>>('/v1/config/requirements').then((x) => x.items),
        ])
      : [[], []] as [Row[], Row[]];

    ctx.root.innerHTML = `<div class="page-stack">
      ${canAdmin || canUnavailable ? `<section class="page-grid">
        ${canAdmin ? `<article class="panel span-4"><h2>Alta de personal</h2><form id="employee-form">
          ${renderField('Número de trabajador', '<input name="employeeNumber" autocomplete="off" required>')}
          ${renderField('Nombre', '<input name="name" autocomplete="off" required>')}
          ${renderField('Email', '<input name="email" type="email" autocomplete="off">')}
          ${renderField('Grupo', `<select name="groupId" id="employee-group" required><option value="">Seleccione</option>${optionsHtml(groups)}</select>`)}
          ${renderField('Nivel base', '<select name="baseLevelId" id="employee-level" required><option value="">Seleccione grupo primero</option></select>')}
          ${renderField('Antigüedad', '<input name="seniorityDate" type="date">')}
          <div class="form-actions"><button class="primary" type="submit">Guardar trabajador</button></div>
        </form></article>
        <article class="panel span-4"><h2>Actualizar requisito</h2><form id="requirement-form">
          ${renderField('Employee ID', '<input name="employeeId" required>')}
          ${renderField('Requisito', `<select name="requirementId" required>${optionsHtml(requirements)}</select>`)}
          ${renderField('Estado', '<select name="status"><option>COMPLIANT</option><option>MISSING</option><option>PENDING</option><option>EXPIRED</option><option>REJECTED</option><option>NOT_APPLICABLE</option></select>')}
          ${renderField('Completado el', '<input name="completedAt" type="date">')}
          ${renderField('Válido hasta', '<input name="validUntil" type="date">')}
          ${renderField('Calificación', '<input name="score" type="number" min="0" max="100" step="0.01">')}
          <div class="form-actions"><button class="primary" type="submit">Guardar requisito</button></div>
        </form></article>` : ''}
        ${canUnavailable ? `<article class="panel span-4"><h2>Indisponibilidad</h2><form id="unavailable-form">
          ${renderField('Employee ID', '<input name="employeeId" required>')}
          ${renderField('Tipo', '<select name="kind"><option>VACATION</option><option>SICK_LEAVE</option><option>PERMISSION</option><option>OTHER_ASSIGNMENT</option><option>MANUAL_BLOCK</option><option>OTHER</option></select>')}
          ${renderField('Inicio', '<input name="startDate" type="date" required>')}
          ${renderField('Fin', '<input name="endDate" type="date" required>')}
          ${renderField('Motivo', '<input name="reason">')}
          <div class="form-actions"><button class="primary" type="submit">Registrar</button></div>
        </form></article>` : ''}
      </section>` : ''}
      <section class="panel"><div class="section-heading"><div><h2>Directorio</h2><p>${employees.length} registros visibles para tu sesión.</p></div></div>
        ${renderTable(employees, [
          { key: 'employee_number', label: 'Número' },
          { key: 'name', label: 'Nombre' },
          { key: 'email', label: 'Email' },
          { key: 'group_id', label: 'Grupo' },
          { key: 'base_level_id', label: 'Nivel base' },
          { key: 'seniority_date', label: 'Antigüedad' },
          { key: 'active', label: 'Activo' },
        ])}
      </section>
    </div>`;

    const group = ctx.root.querySelector<HTMLSelectElement>('#employee-group');
    const level = ctx.root.querySelector<HTMLSelectElement>('#employee-level');
    if (group && level) {
      group.addEventListener('change', async () => {
        level.disabled = true;
        try {
          const rows = group.value ? (await api.get<ListResponse<Row>>(`/v1/config/groups/${encodeURIComponent(group.value)}/levels`)).items : [];
          level.innerHTML = `<option value="">Seleccione</option>${optionsHtml(rows)}`;
        } catch (error) {
          level.innerHTML = '<option value="">Error al cargar niveles</option>';
          showToast(error instanceof Error ? error.message : error, 'danger');
        } finally {
          level.disabled = false;
        }
      });
    }

    ctx.root.querySelector<HTMLFormElement>('#employee-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      await withBusy(button, async () => {
        const fd = new FormData(form);
        await api.post('/v1/employees', {
          employeeNumber: String(fd.get('employeeNumber') ?? '').trim(),
          name: String(fd.get('name') ?? '').trim(),
          email: nullableText(String(fd.get('email') ?? '')),
          groupId: String(fd.get('groupId') ?? ''),
          baseLevelId: String(fd.get('baseLevelId') ?? ''),
          seniorityDate: nullableText(String(fd.get('seniorityDate') ?? '')),
        });
        showToast('Trabajador creado.', 'success');
        await renderEmployees(ctx);
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });

    ctx.root.querySelector<HTMLFormElement>('#requirement-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      await withBusy(button, async () => {
        const fd = new FormData(form);
        const employeeId = String(fd.get('employeeId') ?? '').trim();
        const requirementId = String(fd.get('requirementId') ?? '').trim();
        await api.put(`/v1/employees/${encodeURIComponent(employeeId)}/requirements/${encodeURIComponent(requirementId)}`, {
          status: String(fd.get('status') ?? 'PENDING'),
          completedAt: nullableText(String(fd.get('completedAt') ?? '')),
          validUntil: nullableText(String(fd.get('validUntil') ?? '')),
          score: numberOrNull(String(fd.get('score') ?? '')),
        });
        showToast('Requisito actualizado.', 'success');
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });

    ctx.root.querySelector<HTMLFormElement>('#unavailable-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget as HTMLFormElement;
      const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      await withBusy(button, async () => {
        const fd = new FormData(form);
        const employeeId = String(fd.get('employeeId') ?? '').trim();
        await api.post(`/v1/employees/${encodeURIComponent(employeeId)}/unavailability`, {
          kind: String(fd.get('kind') ?? 'OTHER'),
          startDate: String(fd.get('startDate') ?? ''),
          endDate: String(fd.get('endDate') ?? ''),
          reason: nullableText(String(fd.get('reason') ?? '')),
        });
        showToast('Indisponibilidad registrada.', 'success');
        form.reset();
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });
  } catch (error) {
    ctx.root.innerHTML = renderPageError(error);
  }
}
