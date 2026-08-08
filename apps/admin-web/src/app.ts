import { ApiError } from './core/api-client.js';
import type { PageContext } from './core/page-context.js';
import { canAccessSection } from './core/permissions.js';
import { navigate, routeForHash } from './core/router.js';
import { employeePortalUrl, loadSession } from './core/session.js';
import type { AppEnvironment, AppSection } from './core/types.js';
import { mountShell, type ShellHandle } from './layout/app-shell.js';
import { renderAlert, renderLoading } from './components/ui.js';
import { renderOverview } from './pages/overview.js';
import { renderCoverages } from './pages/coverages.js';
import { renderRotations } from './pages/rotations.js';
import { renderCompetitions } from './pages/competitions.js';
import { renderEmployees } from './pages/employees.js';
import { renderRequirements } from './pages/requirements.js';
import { renderDocuments } from './pages/documents.js';
import { renderRag } from './pages/rag.js';
import { renderAI } from './pages/ai.js';
import { renderInfrastructure } from './pages/infrastructure.js';
import { renderAudit } from './pages/audit.js';
import { renderReports } from './pages/reports.js';
import { renderSettings } from './pages/settings.js';

type PageRenderer = (ctx: PageContext) => Promise<void>;

const pageRenderers: Record<AppSection, PageRenderer> = {
  overview: renderOverview,
  coverages: renderCoverages,
  rotations: renderRotations,
  competitions: renderCompetitions,
  employees: renderEmployees,
  requirements: renderRequirements,
  documents: renderDocuments,
  rag: renderRag,
  ai: renderAI,
  infrastructure: renderInfrastructure,
  audit: renderAudit,
  reports: renderReports,
  settings: renderSettings,
};

function runtimeEnvironment(): AppEnvironment {
  const configured = String(import.meta.env.VITE_APP_ENV ?? '').toLowerCase();
  if (configured === 'development' || configured === 'staging' || configured === 'production') return configured;
  return import.meta.env.PROD ? 'production' : 'development';
}

function renderBootError(root: HTMLElement, error: unknown): void {
  if (error instanceof ApiError && error.status === 401) {
    root.innerHTML = `<main class="main-view"><section class="panel"><h1>Autenticación requerida</h1>${renderAlert('No existe una sesión válida. En producción el acceso debe llegar desde Cloudflare Access; en desarrollo usa VITE_DEV_USER_EMAIL únicamente para pruebas locales.', 'warning', error.correlationId)}</section></main>`;
    return;
  }
  if (error instanceof ApiError && error.status === 403) {
    root.innerHTML = `<main class="main-view"><section class="panel"><h1>Acceso no provisionado</h1>${renderAlert(error.code, 'danger', error.correlationId)}</section></main>`;
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  root.innerHTML = `<main class="main-view"><section class="panel"><h1>No fue posible iniciar YRAK Control Center</h1>${renderAlert(message, 'danger')}</section></main>`;
}

export async function startApp(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('APP_ROOT_NOT_FOUND');
  root.innerHTML = `<main class="main-view">${renderLoading('Validando sesión…')}</main>`;
  const environment = runtimeEnvironment();

  try {
    const session = await loadSession();
    if (session.user.role === 'EMPLOYEE') {
      window.location.assign(employeePortalUrl());
      return;
    }

    let shell: ShellHandle;
    const renderRoute = async () => {
      const route = routeForHash();
      if (!canAccessSection(session.user.role, route.section)) {
        shell.setActive('overview');
        shell.setPageTitle('Acceso restringido', 'La navegación también está protegida en la API');
        shell.view.innerHTML = renderAlert('Tu rol no tiene acceso a esta sección.', 'danger');
        return;
      }
      shell.setActive(route.section);
      const ctx: PageContext = {
        root: shell.view,
        session,
        environment,
        setTitle: (title, subtitle) => shell.setPageTitle(title, subtitle),
        setGlobalStatus: (label, tone) => shell.setGlobalStatus(label, tone),
      };
      try {
        await pageRenderers[route.section](ctx);
        shell.view.focus({ preventScroll: true });
      } catch (error) {
        const correlationId = error instanceof ApiError ? error.correlationId : undefined;
        shell.view.innerHTML = renderAlert(error instanceof Error ? error.message : error, 'danger', correlationId);
      }
    };

    shell = mountShell({
      root,
      session,
      environment,
      onNavigate: (section) => navigate(section),
    });
    window.addEventListener('hashchange', () => { void renderRoute(); });
    await renderRoute();
  } catch (error) {
    renderBootError(root, error);
  }
}
