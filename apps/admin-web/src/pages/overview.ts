import { api, ApiError } from '../core/api-client.js';
import type { PageContext } from '../core/page-context.js';
import type { ListResponse } from '../core/types.js';
import { escapeText } from '../core/security.js';
import { renderBadge, renderEmpty, renderLoading } from '../components/ui.js';
import { icon } from '../components/icons.js';
import { integrations } from '../config/integrations.js';
import {
  buildCoverageDistribution,
  buildOverviewMetrics,
  buildRecentCoverageActivity,
  buildUpcomingCoverages,
  type CoverageDistribution,
  type CoverageSummaryRow,
} from './overview-model.js';

type Row = Record<string, unknown>;

interface IntegrationStatusRow {
  id: string;
  configured: boolean;
  detail?: string;
}

interface IntegrationStatusResponse {
  items: IntegrationStatusRow[];
}

interface SystemHealthResponse {
  database?: string;
  r2?: string;
  workersAi?: string;
  queue?: string;
  workflow?: string;
  email?: string;
  aiProvider?: string;
  aiModel?: string | null;
}

async function optionalList(path: string): Promise<Row[] | undefined> {
  try {
    return (await api.get<ListResponse<Row>>(path)).items;
  } catch (error) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) return undefined;
    throw error;
  }
}

async function optionalGet<T>(path: string): Promise<T | undefined> {
  try {
    return await api.get<T>(path);
  } catch (error) {
    if (error instanceof ApiError && [403, 404].includes(error.status)) return undefined;
    throw error;
  }
}

function activeCompetitionCount(rows: readonly CoverageSummaryRow[]): number {
  return rows.filter((row) => {
    const process = String(row.process_type ?? '').toUpperCase();
    const status = String(row.status ?? '').toUpperCase();
    return process === 'COMPETITION' && !['COMPLETED', 'CANCELLED'].includes(status);
  }).length;
}

function statusTone(status: unknown): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  const normalized = String(status ?? '').toUpperCase();
  if (['ACTIVE', 'SCHEDULED', 'COMPLETED', 'AWARDED', 'READY'].includes(normalized)) return 'success';
  if (['PENDING', 'PENDING_INFORMATION', 'PENDING_VALIDATION', 'PENDING_APPROVAL', 'UNDER_REVIEW', 'PROPOSED'].includes(normalized)) return 'warning';
  if (['FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'BLOCKED'].includes(normalized)) return 'danger';
  return 'neutral';
}

function formatDate(value: unknown): string {
  const text = String(value ?? '');
  if (!text) return '—';
  const date = new Date(text.length === 10 ? `${text}T00:00:00` : text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' }).format(date);
}

function shortId(value: unknown): string {
  const text = String(value ?? '');
  if (!text) return 'Sin ID';
  return text.length > 18 ? `${text.slice(0, 8)}…${text.slice(-5)}` : text;
}

function relativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Sin fecha';
  const delta = Date.now() - timestamp;
  const future = delta < 0;
  const absolute = Math.abs(delta);
  const minutes = Math.floor(absolute / 60_000);
  if (minutes < 1) return future ? 'En breve' : 'Ahora';
  if (minutes < 60) return `${future ? 'En' : 'Hace'} ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${future ? 'En' : 'Hace'} ${hours} h`;
  const days = Math.floor(hours / 24);
  return `${future ? 'En' : 'Hace'} ${days} d`;
}

function donutSvg(distribution: CoverageDistribution): string {
  const values = [distribution.active, distribution.upcoming, distribution.completed, distribution.cancelled, distribution.other];
  const colors = ['#4f7df1', '#e7aa2f', '#42bb6f', '#e85757', '#66788f'];
  const total = Math.max(1, distribution.total);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;
  const circles = values.map((value, index) => {
    if (!value) return '';
    const length = (value / total) * circumference;
    const dashOffset = -accumulated;
    accumulated += length;
    return `<circle cx="50" cy="50" r="${radius}" fill="none" stroke="${colors[index]}" stroke-width="12" stroke-dasharray="${length.toFixed(3)} ${(circumference - length).toFixed(3)}" stroke-dashoffset="${dashOffset.toFixed(3)}"/>`;
  }).join('');
  return `<div class="donut-shell"><svg class="donut-svg" viewBox="0 0 100 100" role="img" aria-label="Distribución de coberturas por estado"><g transform="rotate(-90 50 50)">${circles}</g></svg><div class="donut-center"><span>Total</span><strong>${distribution.total}</strong></div></div>`;
}

function legend(distribution: CoverageDistribution): string {
  const items = [
    ['legend-blue', 'Activas', distribution.active],
    ['legend-amber', 'Próximas', distribution.upcoming],
    ['legend-green', 'Completadas', distribution.completed],
    ['legend-red', 'Canceladas', distribution.cancelled],
    ['legend-gray', 'Otros estados', distribution.other],
  ] as const;
  return `<div class="legend-list">${items.map(([tone, label, value]) => `<div class="legend-row"><span class="legend-dot ${tone}"></span><span>${label}</span><strong>${value}</strong></div>`).join('')}</div>`;
}

function renderUpcoming(rows: readonly CoverageSummaryRow[]): string {
  if (!rows.length) return renderEmpty('No hay coberturas programadas dentro de los próximos 7 días.');
  const visible = rows.slice(0, 6);
  return `<div class="table-wrap"><table class="data-table overview-table"><thead><tr><th>Cobertura</th><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Estado</th><th>Nivel</th></tr></thead><tbody>${visible.map((row) => `<tr>
    <td><span class="coverage-name">${escapeText(shortId(row.id))}</span><span class="coverage-secondary">Grupo ${escapeText(shortId(row.group_id))}</span></td>
    <td>${escapeText(String(row.process_type ?? '—') === 'COMPETITION' ? 'Concurso (6+ días)' : String(row.process_type ?? '—') === 'ROTATION' ? 'Rotación (1–5 días)' : String(row.process_type ?? '—'))}</td>
    <td>${escapeText(formatDate(row.starts_on))}</td>
    <td>${escapeText(formatDate(row.ends_on))}</td>
    <td>${renderBadge(row.status ?? '—', statusTone(row.status))}</td>
    <td>${escapeText(shortId(row.target_level_id))}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

function renderActivity(rows: ReturnType<typeof buildRecentCoverageActivity>): string {
  if (!rows.length) return `<div class="overview-empty-inline">La API actual aún no expone timestamps de actividad en el listado. No se inventan eventos.</div>`;
  return `<div class="activity-feed">${rows.map((row) => `<div class="activity-item">
    <div class="activity-icon">${icon(row.processType === 'COMPETITION' ? 'flag' : 'calendar')}</div>
    <div class="activity-copy"><strong>${escapeText(shortId(row.id))}</strong><span>${escapeText(row.processType)} · ${escapeText(row.status)}</span></div>
    <div class="activity-time">${escapeText(relativeTime(row.timestamp))}</div>
  </div>`).join('')}</div>`;
}

function renderAgents(): string {
  const agents = [
    ['Intake', 'Extracción y borradores'],
    ['Audit', 'Explicación de auditoría'],
    ['Communication', 'Borradores de comunicación'],
    ['Support', 'Consulta de políticas'],
  ] as const;
  return `<div class="agent-list">${agents.map(([name, purpose]) => `<div class="agent-row">
    <div class="agent-icon">${icon('agent')}</div>
    <div class="agent-copy"><strong>Agente ${name}</strong><span>${purpose}</span></div>
    <div class="agent-latency">${renderBadge('Sin verificar', 'neutral')}<span>— ms</span></div>
  </div>`).join('')}</div>`;
}

function renderUsage(health?: SystemHealthResponse): string {
  const labels = ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'Ayer', 'Hoy'];
  return `<div class="usage-chart" aria-label="Uso de modelos sin telemetría conectada">${labels.map(() => '<div class="usage-bar-group"><div class="usage-bar" data-empty="true"></div></div>').join('')}</div>
  <div class="usage-axis">${labels.map((label) => `<span>${label}</span>`).join('')}</div>
  <div class="usage-legend"><span><i class="legend-blue"></i>${escapeText(health?.aiProvider ?? 'Proveedor activo no visible')}</span><span><i class="legend-gray"></i>${escapeText(health?.aiModel ?? 'Modelo no reportado')}</span></div>
  <div class="overview-empty-inline">La telemetría de tokens/costos todavía no está conectada; el Dashboard no fabrica consumo.</div>`;
}

function integrationGlyph(id: string): string {
  if (id === 'cloudflare' || id === 'modal') return icon('cloud');
  if (id === 'supabase') return icon('database');
  if (id === 'upstash') return icon('bolt');
  if (id === 'gmail') return icon('mail');
  return icon('model');
}

function renderServiceStrip(status?: IntegrationStatusResponse, health?: SystemHealthResponse): string {
  const byId = new Map((status?.items ?? []).map((item) => [item.id, item]));
  return `<div class="service-strip">${integrations.map((descriptor) => {
    const row = byId.get(descriptor.id);
    const configured = row?.configured ?? false;
    const specialCloudflare = descriptor.id === 'cloudflare' && health?.database === 'healthy';
    const label = specialCloudflare ? 'D1 OK' : configured ? 'Configurado' : 'No configurado';
    const tone = specialCloudflare || configured ? 'success' : 'neutral';
    return `<div class="service-cell"><div class="service-name"><span class="service-icon">${integrationGlyph(descriptor.id)}</span><span>${escapeText(descriptor.name)}</span></div>${renderBadge(label, tone)}<small>${escapeText(row?.detail ?? descriptor.purpose)}</small></div>`;
  }).join('')}</div>`;
}

export async function renderOverview(ctx: PageContext): Promise<void> {
  ctx.setTitle('Overview', 'Resumen general del sistema');
  ctx.root.innerHTML = renderLoading('Cargando resumen operativo…');

  try {
    const [employees, groups, coveragesRaw, health, integrationStatus] = await Promise.all([
      optionalList('/v1/employees'),
      optionalList('/v1/reference/groups'),
      optionalList('/v1/coverage-cases'),
      optionalGet<SystemHealthResponse>('/v1/system/health'),
      optionalGet<IntegrationStatusResponse>('/v1/system/integrations'),
    ]);

    const coverages = (coveragesRaw ?? []) as CoverageSummaryRow[];
    const metrics = buildOverviewMetrics({ employees, groups, coverages: coveragesRaw ? coverages : undefined });
    const distribution = buildCoverageDistribution(coverages);
    const upcoming = buildUpcomingCoverages(coverages);
    const activity = buildRecentCoverageActivity(coverages);
    const competitions = activeCompetitionCount(coverages);

    ctx.setGlobalStatus(health?.database === 'down' ? 'D1 degradada' : 'API conectada', health?.database === 'down' ? 'warning' : 'success');
    ctx.root.innerHTML = `<div class="page-stack overview-page">
      <section class="overview-kpi-grid">
        <article class="metric-card metric-blue"><div class="metric-head"><div><span class="metric-title">Coberturas Activas</span><strong>${distribution.active}</strong></div><span class="metric-icon">${icon('calendar')}</span></div><div class="metric-foot">Expedientes actualmente activos</div></article>
        <article class="metric-card metric-green"><div class="metric-head"><div><span class="metric-title">Próximas Coberturas</span><strong>${upcoming.length}</strong></div><span class="metric-icon">${icon('clock')}</span></div><div class="metric-foot">Siguientes 7 días</div></article>
        <article class="metric-card metric-purple"><div class="metric-head"><div><span class="metric-title">Concursos Abiertos</span><strong>${competitions}</strong></div><span class="metric-icon">${icon('flag')}</span></div><div class="metric-foot">Procesos 6+ no terminales</div></article>
        <article class="metric-card metric-amber"><div class="metric-head"><div><span class="metric-title">Alertas Activas</span><strong>—</strong></div><span class="metric-icon">${icon('alert')}</span></div><div class="metric-foot">Fuente de alertas aún no conectada</div></article>
        <article class="metric-card metric-cyan"><div class="metric-head"><div><span class="metric-title">Personal Disponible</span><strong>—</strong></div><span class="metric-icon">${icon('users')}</span></div><div class="metric-foot">${metrics.employees === null ? 'Sin permiso para directorio' : `${metrics.employees} trabajadores visibles; disponibilidad requiere cruce de ausencias`}</div></article>
      </section>

      <section class="dashboard-primary-grid">
        <article class="panel dashboard-panel"><div class="dashboard-panel-title"><h2>Coberturas por Estado</h2><small>Registros visibles</small></div><div class="coverage-donut-wrap">${donutSvg(distribution)}${legend(distribution)}</div><div class="metric-note">Distribución del listado accesible para el rol actual.</div></article>
        <article class="panel dashboard-panel"><div class="dashboard-panel-title"><h2>Coberturas Próximas <span class="panel-subtitle">(Próximos 7 días)</span></h2><small>${upcoming.length} detectadas</small></div>${renderUpcoming(upcoming)}<a class="subtle-link" href="#/coverages">Ver todas las coberturas →</a></article>
      </section>

      <section class="dashboard-secondary-grid">
        <article class="panel dashboard-panel"><div class="dashboard-panel-title"><h2>Actividad Reciente</h2><small>Coberturas visibles</small></div>${renderActivity(activity)}<a class="subtle-link" href="#/audit">Ir a auditoría →</a></article>
        <article class="panel dashboard-panel"><div class="dashboard-panel-title"><h2>Estado de Agentes</h2><small>Sin autoridad laboral</small></div>${renderAgents()}<a class="subtle-link" href="#/ai">Ver agentes →</a></article>
        <article class="panel dashboard-panel"><div class="dashboard-panel-title"><h2>Uso de Modelos <span class="panel-subtitle">(Tokens)</span></h2><small>7 días</small></div>${renderUsage(health)}<a class="subtle-link" href="#/ai">Ver proveedor activo →</a></article>
      </section>

      <section class="panel dashboard-panel"><div class="dashboard-panel-title"><h2>Estado de Infraestructura</h2><small>Configuración detectada, no health completo</small></div>${renderServiceStrip(integrationStatus, health)}<a class="subtle-link" href="#/infrastructure">Ver todas las conexiones →</a></section>
    </div>`;
  } catch (error) {
    ctx.setGlobalStatus('API degradada', 'warning');
    const correlationId = error instanceof ApiError ? error.correlationId : undefined;
    ctx.root.innerHTML = `<div class="alert alert-danger">${escapeText(error instanceof Error ? error.message : error)}${correlationId ? `<small>Correlation ID: ${escapeText(correlationId)}</small>` : ''}</div>`;
  }
}
