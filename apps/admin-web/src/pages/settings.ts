import { api } from '../core/api-client.js';
import type { PageContext } from '../core/page-context.js';
import type { ListResponse } from '../core/types.js';
import { nullableText, numberOrNull, optionsHtml, parseCsvIds, renderPageError } from '../core/page-utils.js';
import { renderAlert, renderField, renderLoading, renderTable, showToast, withBusy } from '../components/ui.js';

type Row = Record<string, unknown>;

export async function renderSettings(ctx: PageContext): Promise<void> {
  ctx.setTitle('Configuración', 'Catálogos y estructuras administrables; permisos reforzados por API');
  ctx.root.innerHTML = renderLoading('Cargando configuración…');
  try {
    const [groups, requirements, users] = await Promise.all([
      api.get<ListResponse<Row>>('/v1/config/groups').then((x) => x.items),
      api.get<ListResponse<Row>>('/v1/config/requirements').then((x) => x.items),
      api.get<ListResponse<Row>>('/v1/config/users').then((x) => x.items),
    ]);
    const provisionableRoles = ctx.session.user.role === 'ADMIN'
      ? ['ADMIN','HR','SUPERVISOR','COMMITTEE','OPERATOR','EMPLOYEE','AUDITOR']
      : ['SUPERVISOR','COMMITTEE','OPERATOR','EMPLOYEE'];

    ctx.root.innerHTML = `<div class="page-stack">
      ${renderAlert('Los cambios de configuración afectan qué transiciones, requisitos y usuarios puede usar el sistema. La API valida scope, integridad y escalación de privilegios; el Dashboard no puede omitir esas validaciones.', 'warning')}
      <section class="page-grid">
        <article class="panel span-4"><h2>Crear grupo</h2><form id="settings-group-form">
          ${renderField('Nombre', '<input name="name" required>')}
          ${renderField('Descripción', '<input name="description">')}
          <button class="primary" type="submit">Crear grupo</button>
        </form></article>
        <article class="panel span-4"><h2>Crear nivel</h2><form id="settings-level-form">
          ${renderField('Grupo', `<select name="groupId" required>${optionsHtml(groups)}</select>`)}
          ${renderField('Número', '<input name="number" type="number" step="1" required>')}
          ${renderField('Nombre', '<input name="name" required>')}
          ${renderField('Orden', '<input name="rankOrder" type="number" step="1" required>')}
          <button class="primary" type="submit">Crear nivel</button>
        </form></article>
        <article class="panel span-4"><h2>Autorizar transición</h2><form id="settings-transition-form">
          ${renderField('Grupo', `<select name="groupId" required>${optionsHtml(groups)}</select>`)}
          ${renderField('Source Level ID', '<input name="sourceLevelId" required>')}
          ${renderField('Target Level ID', '<input name="targetLevelId" required>')}
          <button class="primary" type="submit">Crear transición</button>
        </form></article>
        <article class="panel span-4"><h2>Crear requisito</h2><form id="settings-requirement-form">
          ${renderField('Nombre', '<input name="name" required>')}
          ${renderField('Tipo', '<select name="requirementType"><option>COURSE</option><option>CERTIFICATION</option><option>PREREQUISITE_EXAM</option><option>DOCUMENT</option><option>EXPERIENCE</option><option>OTHER</option></select>')}
          ${renderField('Vigencia en días', '<input name="validityDays" type="number" min="1" step="1">')}
          <button class="primary" type="submit">Crear requisito</button>
        </form></article>
        <article class="panel span-4"><h2>Crear usuario</h2><form id="settings-user-form">
          ${renderField('Email', '<input name="email" type="email" required>')}
          ${renderField('Nombre visible', '<input name="displayName" required>')}
          ${renderField('Rol', `<select name="role" id="settings-user-role">${provisionableRoles.map((role) => `<option>${role}</option>`).join('')}</select>`)}
          ${renderField('Employee ID', '<input name="employeeId" id="settings-user-employee-id">', 'Obligatorio cuando el rol es EMPLOYEE. La API verifica que pertenezca a la organización.')}
          ${renderField('Group IDs', '<input name="groupIds" placeholder="id1,id2">', 'Separados por coma. Se eliminan duplicados y la API valida cada grupo.')}
          <button class="primary" type="submit">Crear usuario</button>
        </form></article>
        <article class="panel span-4"><h2>Crear pool de rotación</h2><form id="settings-pool-form">
          ${renderField('Grupo', `<select name="groupId" required>${optionsHtml(groups)}</select>`)}
          ${renderField('Source Level ID', '<input name="sourceLevelId" required>')}
          ${renderField('Target Level ID', '<input name="targetLevelId" required>')}
          ${renderField('Employee IDs', '<textarea name="employeeIds" placeholder="id1,id2,id3" required></textarea>', 'Todos deben pertenecer al grupo y nivel origen; no se admiten duplicados.')}
          <button class="primary" type="submit">Crear pool</button>
        </form></article>
      </section>
      <section class="page-grid">
        <article class="panel span-6"><h2>Grupos</h2>${renderTable(groups, [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Nombre' }, { key: 'active', label: 'Activo' }])}</article>
        <article class="panel span-6"><h2>Requisitos</h2>${renderTable(requirements, [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Nombre' }, { key: 'requirement_type', label: 'Tipo' }, { key: 'validity_days', label: 'Vigencia' }])}</article>
        <article class="panel span-12"><h2>Usuarios</h2>${renderTable(users, [{ key: 'id', label: 'ID' }, { key: 'email', label: 'Email' }, { key: 'display_name', label: 'Nombre' }, { key: 'role', label: 'Rol' }, { key: 'employee_id', label: 'Employee ID' }, { key: 'active', label: 'Activo' }])}</article>
      </section>
    </div>`;

    const roleSelect = ctx.root.querySelector<HTMLSelectElement>('#settings-user-role');
    const employeeIdInput = ctx.root.querySelector<HTMLInputElement>('#settings-user-employee-id');
    const syncEmployeeRequirement = () => {
      if (!roleSelect || !employeeIdInput) return;
      employeeIdInput.required = roleSelect.value === 'EMPLOYEE';
    };
    roleSelect?.addEventListener('change', syncEmployeeRequirement);
    syncEmployeeRequirement();

    bindJsonForm(ctx, '#settings-group-form', async (fd) => api.post('/v1/config/groups', {
      name: String(fd.get('name') ?? '').trim(),
      description: nullableText(String(fd.get('description') ?? '')) ?? undefined,
    }), 'Grupo creado.');

    bindJsonForm(ctx, '#settings-level-form', async (fd) => {
      const groupId = String(fd.get('groupId') ?? '').trim();
      return api.post(`/v1/config/groups/${encodeURIComponent(groupId)}/levels`, {
        number: Number(fd.get('number')),
        name: String(fd.get('name') ?? '').trim(),
        rankOrder: Number(fd.get('rankOrder')),
      });
    }, 'Nivel creado.');

    bindJsonForm(ctx, '#settings-transition-form', async (fd) => {
      const groupId = String(fd.get('groupId') ?? '').trim();
      return api.post(`/v1/config/groups/${encodeURIComponent(groupId)}/transitions`, {
        sourceLevelId: String(fd.get('sourceLevelId') ?? '').trim(),
        targetLevelId: String(fd.get('targetLevelId') ?? '').trim(),
      });
    }, 'Transición autorizada.');

    bindJsonForm(ctx, '#settings-requirement-form', async (fd) => api.post('/v1/config/requirements', {
      name: String(fd.get('name') ?? '').trim(),
      requirementType: String(fd.get('requirementType') ?? 'OTHER'),
      validityDays: numberOrNull(String(fd.get('validityDays') ?? '')),
    }), 'Requisito creado.');

    bindJsonForm(ctx, '#settings-user-form', async (fd) => api.post('/v1/config/users', {
      email: String(fd.get('email') ?? '').trim(),
      displayName: String(fd.get('displayName') ?? '').trim(),
      role: String(fd.get('role') ?? 'EMPLOYEE'),
      employeeId: nullableText(String(fd.get('employeeId') ?? '')),
      groupIds: parseCsvIds(String(fd.get('groupIds') ?? '')),
    }), 'Usuario creado.');

    bindJsonForm(ctx, '#settings-pool-form', async (fd) => api.post('/v1/config/rotation-pools', {
      groupId: String(fd.get('groupId') ?? '').trim(),
      sourceLevelId: String(fd.get('sourceLevelId') ?? '').trim(),
      targetLevelId: String(fd.get('targetLevelId') ?? '').trim(),
      employeeIds: parseCsvIds(String(fd.get('employeeIds') ?? '')),
    }), 'Pool creado.');
  } catch (error) {
    ctx.root.innerHTML = renderPageError(error);
  }
}

function bindJsonForm(
  ctx: PageContext,
  selector: string,
  submit: (data: FormData) => Promise<unknown>,
  success: string,
): void {
  ctx.root.querySelector<HTMLFormElement>(selector)?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    await withBusy(button, async () => {
      await submit(new FormData(form));
      showToast(success, 'success');
      await renderSettings(ctx);
    }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
  });
}
