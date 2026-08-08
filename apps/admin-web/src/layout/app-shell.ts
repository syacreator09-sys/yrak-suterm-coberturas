import { icon, type IconName } from '../components/icons.js';
import { allowedSections } from '../core/permissions.js';
import { escapeText } from '../core/security.js';
import type { AppEnvironment, AppSection, AppSession } from '../core/types.js';

const nav: Array<{ section: AppSection; label: string; group: string; icon: IconName }> = [
  { section: 'overview', label: 'Overview', group: 'Principal', icon: 'activity' },
  { section: 'coverages', label: 'Coberturas', group: 'Operación', icon: 'calendar' },
  { section: 'rotations', label: 'Rotaciones 1–5 días', group: 'Operación', icon: 'clock' },
  { section: 'competitions', label: 'Concursos 6+ días', group: 'Operación', icon: 'flag' },
  { section: 'employees', label: 'Personal', group: 'Operación', icon: 'users' },
  { section: 'requirements', label: 'Requisitos', group: 'Operación', icon: 'alert' },
  { section: 'documents', label: 'Documentos / Intake', group: 'Documentos & RAG', icon: 'database' },
  { section: 'rag', label: 'RAG Center', group: 'Documentos & RAG', icon: 'search' },
  { section: 'ai', label: 'Agentes & Modelos', group: 'IA & Agentes', icon: 'agent' },
  { section: 'infrastructure', label: 'Estado de Servicios', group: 'Infraestructura', icon: 'cloud' },
  { section: 'audit', label: 'Eventos', group: 'Auditoría', icon: 'activity' },
  { section: 'reports', label: 'Reportes', group: 'Reportes', icon: 'database' },
  { section: 'settings', label: 'Configuración', group: 'Sistema', icon: 'bolt' },
];

export interface ShellHandle {
  view: HTMLElement;
  setActive(section: AppSection): void;
  setPageTitle(title: string, subtitle?: string): void;
  setGlobalStatus(label: string, tone?: 'success'|'warning'|'danger'|'neutral'): void;
}

function envTone(environment: AppEnvironment): string {
  return environment === 'production' ? 'danger' : environment === 'staging' ? 'warning' : 'neutral';
}

function shortOrganization(id: string): string {
  const trimmed = id.trim();
  return trimmed.length > 12 ? `${trimmed.slice(0, 8)}…` : trimmed;
}

function normalized(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function brandShield(): string {
  return `<svg class="brand-shield" viewBox="0 0 32 38" fill="none" aria-hidden="true"><path d="M16 2 28 6v10c0 8.1-4.8 15.3-12 19-7.2-3.7-12-10.9-12-19V6L16 2Z" stroke="currentColor" stroke-width="1.6"/><path d="m10 11 6 7 6-7M16 18v9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function mountShell(options: {
  root: HTMLElement;
  session: AppSession;
  environment: AppEnvironment;
  onNavigate: (section: AppSection) => void;
}): ShellHandle {
  const sections = new Set(allowedSections(options.session.user.role));
  const visible = nav.filter((item) => sections.has(item.section));
  const grouped = new Map<string, typeof visible>();
  for (const item of visible) {
    const items = grouped.get(item.group) ?? [];
    items.push(item);
    grouped.set(item.group, items);
  }

  options.root.innerHTML = `<div class="app-shell">
    <aside class="sidebar" id="sidebar" aria-label="Navegación principal">
      <div class="brand-block">
        <div class="brand-mark">${brandShield()}</div>
        <div><strong>YRAK</strong><span>Control Center</span></div>
      </div>
      <nav class="sidebar-nav">${[...grouped.entries()].map(([group, items]) => `
        <section class="nav-group"><div class="nav-group-label">${escapeText(group)}</div>
        ${items.map((item) => `<button class="nav-item" data-section="${item.section}" type="button"><span class="nav-icon">${icon(item.icon, 'nav-svg-icon')}</span><span>${escapeText(item.label)}</span></button>`).join('')}</section>`).join('')}</nav>
      <div class="sidebar-footer">
        <div class="user-card"><div class="avatar">${escapeText(options.session.user.email.slice(0, 1).toUpperCase())}</div><div class="user-meta"><strong>${escapeText(options.session.user.email)}</strong><span>${escapeText(options.session.user.role)} · <i class="online-dot"></i> En línea</span></div></div>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div class="topbar-left"><button id="menu-toggle" class="icon-button mobile-only" aria-label="Abrir menú">☰</button><div><h1 id="page-title">Overview</h1><p id="page-subtitle">Resumen general del sistema</p></div></div>
        <div class="topbar-search">
          <label class="sr-only" for="quick-nav">Buscar o ir rápidamente a una sección</label>
          <div class="search-control"><span>${icon('search', 'search-icon')}</span><input id="quick-nav" list="quick-nav-options" type="search" autocomplete="off" placeholder="Buscar / ir a sección…" aria-label="Buscar o ir rápidamente a una sección"></div>
          <datalist id="quick-nav-options">${visible.map((item) => `<option value="${escapeText(item.label)}"></option>`).join('')}</datalist>
        </div>
        <div class="topbar-actions">
          <span class="badge badge-neutral" title="Organización actual">Org · ${escapeText(shortOrganization(options.session.user.organizationId))}</span>
          <span class="badge badge-info">${escapeText(options.session.user.role)}</span>
          <span class="badge badge-${envTone(options.environment)}">${escapeText(options.environment.toUpperCase())}</span>
          <span id="global-status" class="badge badge-neutral">Sin verificar</span>
        </div>
      </header>
      <main id="view" class="main-view" tabindex="-1"></main>
    </div>
  </div>`;

  const sidebar = options.root.querySelector<HTMLElement>('#sidebar')!;
  const view = options.root.querySelector<HTMLElement>('#view')!;
  options.root.querySelector<HTMLButtonElement>('#menu-toggle')?.addEventListener('click', () => sidebar.classList.toggle('open'));
  for (const button of options.root.querySelectorAll<HTMLButtonElement>('[data-section]')) {
    button.addEventListener('click', () => {
      sidebar.classList.remove('open');
      options.onNavigate(button.dataset.section as AppSection);
    });
  }

  const quickNav = options.root.querySelector<HTMLInputElement>('#quick-nav');
  const navigateFromQuickSearch = () => {
    if (!quickNav) return;
    const query = normalized(quickNav.value);
    if (!query) return;
    const exact = visible.find((item) => normalized(item.label) === query);
    const partial = exact ?? visible.find((item) => normalized(item.label).includes(query) || normalized(item.section).includes(query));
    if (!partial) return;
    quickNav.value = '';
    options.onNavigate(partial.section);
  };
  quickNav?.addEventListener('change', navigateFromQuickSearch);
  quickNav?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    navigateFromQuickSearch();
  });

  return {
    view,
    setActive(section) {
      for (const button of options.root.querySelectorAll<HTMLButtonElement>('[data-section]')) {
        const active = button.dataset.section === section;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      }
    },
    setPageTitle(title, subtitle) {
      options.root.querySelector('#page-title')!.textContent = title;
      options.root.querySelector('#page-subtitle')!.textContent = subtitle ?? '';
      document.title = `${title} · YRAK Control Center`;
    },
    setGlobalStatus(label, tone = 'neutral') {
      const element = options.root.querySelector<HTMLElement>('#global-status')!;
      element.textContent = label;
      element.className = `badge badge-${tone}`;
    },
  };
}
