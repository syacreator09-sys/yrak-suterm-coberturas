import type { AppSection } from './types.js';

const sections = new Set<AppSection>([
  'overview',
  'coverages',
  'rotations',
  'competitions',
  'employees',
  'requirements',
  'documents',
  'rag',
  'ai',
  'infrastructure',
  'audit',
  'reports',
  'settings',
]);

export interface AppRoute {
  section: AppSection;
}

export function routeForHash(hash = window.location.hash): AppRoute {
  const clean = hash.replace(/^#\/?/, '').split(/[?&]/, 1)[0]?.trim() ?? '';
  const candidate = clean.split('/')[0] as AppSection | undefined;
  return { section: candidate && sections.has(candidate) ? candidate : 'overview' };
}

export function navigate(section: AppSection): void {
  const next = `#/${section}`;
  if (window.location.hash === next) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = next;
}
