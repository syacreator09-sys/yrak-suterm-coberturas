import { api } from '../core/api-client.js';
import type { PageContext } from '../core/page-context.js';
import { renderAlert, showToast, withBusy } from '../components/ui.js';

const reports = [
  { id: 'employees', label: 'Personal', path: '/v1/reports/employees.csv', filename: 'employees.csv', elevatedOnly: false },
  { id: 'coverages', label: 'Coberturas', path: '/v1/reports/coverage-cases.csv', filename: 'coverage-cases.csv', elevatedOnly: false },
  { id: 'audit', label: 'Auditoría', path: '/v1/reports/audit.csv', filename: 'audit.csv', elevatedOnly: true },
] as const;

export async function renderReports(ctx: PageContext): Promise<void> {
  ctx.setTitle('Reportes', 'Exportaciones CSV generadas por la API');
  const elevated = ['ADMIN', 'HR', 'AUDITOR'].includes(ctx.session.user.role);
  const visibleReports = reports.filter((report) => !report.elevatedOnly || elevated);
  ctx.root.innerHTML = `<div class="page-stack">
    ${renderAlert('Las exportaciones respetan organización, grupo y rol. Supervisores/comité sólo reciben datos de sus grupos autorizados; la exportación completa de auditoría queda restringida.', 'info')}
    <section class="page-grid">${visibleReports.map((report) => `<article class="panel span-4"><h2>${report.label}</h2><p class="muted">Descarga CSV desde el backend autenticado.</p><button class="primary report-download" data-report="${report.id}" type="button">Descargar ${report.filename}</button></article>`).join('')}</section>
  </div>`;

  for (const button of ctx.root.querySelectorAll<HTMLButtonElement>('.report-download')) {
    button.addEventListener('click', async () => {
      const report = visibleReports.find((item) => item.id === button.dataset.report);
      if (!report) return;
      await withBusy(button, async () => {
        const csv = await api.get<string>(report.path);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = report.filename;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        showToast(`Reporte ${report.filename} generado.`, 'success');
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });
  }
}
