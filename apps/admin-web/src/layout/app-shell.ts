import { allowedSections } from '../core/permissions.js';
import { escapeText } from '../core/security.js';
import type { AppEnvironment, AppSection, AppSession } from '../core/types.js';

const nav: Array<{ section: AppSection; label: string; group: string; icon: string }> = [
  { section: 'overview', label: 'Overview', group: 'Principal', icon: '◫' },
  { section: 'coverages', label: 'Coberturas', group: 'Operación', icon: '▣' },
  { section: 'rotations', label: 'Rotaciones 1–5', group: 'Operación', icon: '↻' },
  { section: 'competitions', label: 'Concursos 6+', group: 'Operación', icon: '◇' },
  { section: 'employees', label: 'Personal', group: 'Operación', icon: '◎' },
  { section: 'requirements', label: 'Requisitos', group: 'Operación', icon: '✓' },
  { section: 'documents', label: 'Documentos', group: 'Conocimiento', icon: '▤' },
  { section: 'rag', label: 'RAG', group: 'Conocimiento', icon: '⌕' },
  { section: 'ai', label: 'IA y agentes', group: 'Sistema', icon: '✦' },
  { section: 'infrastructure', label: 'Infraestructura', group: 'Sistema', icon: '⌁' },
  { section: 'audit', label: 'Auditoría', group: 'Control', icon: '◉' },
  { section: 'reports', label: 'Reportes', group: 'Control', icon: '▥' },
  { section: 'settings', label: 'Configuración', group: 'Control', icon: '⚙' },
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
        <div class="brand-mark">Y</div>
        <div><strong>YRAK</strong><span>Control Center</span></div>
      </div>
      <nav class="sidebar-nav">${[...grouped.entries()].map(([group, items]) => `
        <section class="nav-group"><div class="nav-group-label">${escapeText(group)}</div>
        ${items.map((item) => `<button class="nav-item" data-section="${item.section}" type="button"><span class="nav-icon">${escapeText(item.icon)}</span><span>${escapeText(item.label)}</span></button>`).join('')}</section>`).join('')}</nav>
      <div class="sidebar-footer">
        <div class="user-card"><div class="avatar">${escapeText(options.session.user.email.slice(0, 1).toUpperCase())}</div><div class="user-meta"><strong>${escapeText(options.session.user.email)}</strong><span>${escapeText(options.session.user.role)}</span></div></div>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div class="topbar-left"><button id="menu-toggle" class="icon-button mobile-only" aria-label="Abrir menú">☰</button><div><h1 id="page-title">Overview</h1><p id="page-subtitle">Estado operativo y del sistema</p></div></div>
        <div class="topbar-search">
          <label class="sr-only" for="quick-nav">Ir rápidamente a una sección</label>
          <input id="quick-nav" list="quick-nav-options" type="search" autocomplete="off" placeholder="Ir a una sección…" aria-label="Ir rápidamente a una sección">
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
