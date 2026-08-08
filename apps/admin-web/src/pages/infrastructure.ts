import { api } from '../core/api-client.js';
import type { PageContext } from '../core/page-context.js';
import { escapeText, safeExternalUrl } from '../core/security.js';
import type { IntegrationHealth } from '../core/types.js';
import { integrations } from '../config/integrations.js';
import { renderAlert, renderHealth, renderLoading } from '../components/ui.js';
import { renderPageError } from '../core/page-utils.js';

interface IntegrationStatusRow {
  id: string;
  configured: boolean;
  detail?: string;
}

interface IntegrationStatusResponse {
  items: IntegrationStatusRow[];
}

interface SystemHealthResponse {
  service: string;
  environment: string;
  database: string;
  r2: string;
  workersAi: string;
  queue: string;
  workflow: string;
  email: string;
}

function statusFor(configured: boolean): IntegrationHealth {
  return configured ? 'unknown' : 'not_configured';
}

export async function renderInfrastructure(ctx: PageContext): Promise<void> {
  ctx.setTitle('Infraestructura', 'Estado de configuración sin exponer credenciales');
  ctx.root.innerHTML = renderLoading('Consultando bindings e integraciones…');
  try {
    const [system, integrationStatus] = await Promise.all([
      api.get<SystemHealthResponse>('/v1/system/health'),
      api.get<IntegrationStatusResponse>('/v1/system/integrations'),
    ]);
    const byId = new Map(integrationStatus.items.map((row) => [row.id, row]));
    const cards = integrations.map((descriptor) => {
      const row = byId.get(descriptor.id);
      const configured = row?.configured ?? false;
      const status = statusFor(configured);
      const url = safeExternalUrl(descriptor.dashboardUrl, ctx.environment);
      return `<article class="integration-card card">
        <header><h3>${escapeText(descriptor.name)}</h3>${renderHealth(status)}</header>
        <p>${escapeText(descriptor.purpose)}</p>
        <div class="integration-meta">
          <div><span>Configuración</span><strong>${configured ? 'Detectada' : 'No detectada'}</strong></div>
          <div><span>Health real</span><strong>${configured ? 'Pendiente de test específico' : 'No aplica'}</strong></div>
          ${row?.detail ? `<div><span>Binding</span><strong>${escapeText(row.detail)}</strong></div>` : ''}
        </div>
        ${url ? `<div class="actions"><a class="secondary" href="${escapeText(url)}" target="_blank" rel="noopener noreferrer">Abrir dashboard oficial</a></div>` : ''}
      </article>`;
    }).join('');

    const databaseTone = system.database === 'healthy' ? 'success' : 'danger';
    ctx.setGlobalStatus(system.database === 'healthy' ? 'API / D1 disponible' : 'D1 no disponible', databaseTone);
    ctx.root.innerHTML = `<div class="page-stack">
      ${renderAlert('“Configurado” sólo significa que el servidor detecta un binding/variable. No se marca como healthy hasta ejecutar un health check real del servicio.', 'info')}
      <section class="panel"><h2>Cloudflare runtime</h2><div class="integration-grid">
        ${[['D1', system.database], ['R2', system.r2], ['Workers AI', system.workersAi], ['Queue', system.queue], ['Workflow', system.workflow], ['Email', system.email]].map(([label, value]) => `<article class="integration-card card"><header><h3>${escapeText(label)}</h3></header><p>${escapeText(value)}</p></article>`).join('')}
      </div></section>
      <section><div class="section-heading"><div><h2>Servicios del stack</h2><p>Vista unificada; los secretos permanecen sólo en el entorno del servidor.</p></div></div><div class="integration-grid mt-12">${cards}</div></section>
    </div>`;
  } catch (error) {
    ctx.root.innerHTML = renderPageError(error);
  }
}
