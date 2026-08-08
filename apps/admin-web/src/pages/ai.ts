import { api } from '../core/api-client.js';
import type { PageContext } from '../core/page-context.js';
import { canRunSyntheticDiagnostic, escapeText } from '../core/security.js';
import { renderAlert, renderHealth, renderJson, renderLoading, showToast, withBusy } from '../components/ui.js';
import { renderPageError } from '../core/page-utils.js';

interface SystemHealth {
  workersAi: string;
  environment: string;
  aiProvider: string;
  aiModel: string | null;
}

interface SmokeResult {
  ok: boolean;
  provider: string;
  model: string | null;
  latencyMs: number;
  responseChars: number;
}

const agents = [
  { name: 'Intake', purpose: 'Extrae información y crea borradores para revisión humana.' },
  { name: 'Audit', purpose: 'Explica hechos de auditoría en modo lectura.' },
  { name: 'Communication', purpose: 'Redacta borradores de comunicación; no envía por sí solo.' },
  { name: 'Support', purpose: 'Responde usando políticas disponibles sin decidir coberturas.' },
] as const;

export async function renderAI(ctx: PageContext): Promise<void> {
  ctx.setTitle('IA y agentes', 'Observabilidad, proveedor activo y pruebas sintéticas');
  ctx.root.innerHTML = renderLoading('Consultando estado de IA…');
  try {
    const health = await api.get<SystemHealth>('/v1/system/health');
    const canSmoke = canRunSyntheticDiagnostic(ctx.environment) && ['ADMIN', 'HR'].includes(ctx.session.user.role);
    ctx.root.innerHTML = `<div class="page-stack">
      ${renderAlert('IA interpreta y comunica. El motor de reglas decide. Los agentes no pueden seleccionar ganadores, mover colas, alterar calificaciones ni adjudicar coberturas.', 'warning')}
      <section class="page-grid">
        <article class="panel span-8"><div class="section-heading"><div><h2>Agentes permitidos</h2><p>Capacidades acotadas por diseño.</p></div></div>
          <div class="integration-grid mt-12">${agents.map((agent) => `<article class="integration-card card"><header><h3>${escapeText(agent.name)}</h3>${renderHealth('unknown')}</header><p>${escapeText(agent.purpose)}</p><div class="integration-meta"><div><span>Autoridad laboral</span><strong>Ninguna</strong></div><div><span>Runtime</span><strong>Se verifica al desplegar agent-worker</strong></div></div></article>`).join('')}</div>
        </article>
        <article class="panel span-4"><h2>Runtime de IA</h2><div class="key-value">
          <dt>Proveedor activo</dt><dd>${escapeText(health.aiProvider)}</dd>
          <dt>Modelo activo</dt><dd>${escapeText(health.aiModel ?? 'No definido')}</dd>
          <dt>Workers AI binding</dt><dd>${escapeText(health.workersAi)}</dd>
          <dt>Entorno</dt><dd>${escapeText(health.environment)}</dd>
          <dt>Smoke test</dt><dd>${canSmoke ? 'Disponible con datos sintéticos' : 'Bloqueado en este rol/entorno'}</dd>
        </div>
          ${canSmoke ? '<div class="actions"><button class="primary" id="ai-smoke" type="button">Ejecutar smoke test sintético</button></div>' : ''}
          <div id="ai-smoke-output"></div>
        </article>
      </section>
      <section class="panel"><h2>Política de proveedor</h2><p class="muted">El Dashboard no contiene API keys. El proveedor/modelo se resuelve en backend mediante la capa AIProvider/AIRouter y variables seguras del entorno.</p></section>
    </div>`;

    ctx.root.querySelector<HTMLButtonElement>('#ai-smoke')?.addEventListener('click', async (event) => {
      const button = event.currentTarget as HTMLButtonElement;
      await withBusy(button, async () => {
        const result = await api.post<SmokeResult>('/v1/system/ai-smoke-test');
        const output = ctx.root.querySelector<HTMLElement>('#ai-smoke-output')!;
        output.innerHTML = `<div class="mt-12">${result.ok ? renderAlert('Smoke test correcto.', 'success') : renderAlert('El proveedor respondió, pero no cumplió el contrato sintético.', 'warning')}${renderJson(result)}</div>`;
        showToast(result.ok ? 'Proveedor IA verificado.' : 'Smoke test respondió con advertencia.', result.ok ? 'success' : 'warning');
      }).catch((error) => showToast(error instanceof Error ? error.message : error, 'danger'));
    });
  } catch (error) {
    ctx.root.innerHTML = renderPageError(error);
  }
}
