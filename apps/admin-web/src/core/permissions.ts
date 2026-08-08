import type { AppRole, AppSection } from './types.js';

const access: Record<AppSection, readonly AppRole[]> = {
  overview: ['ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'OPERATOR', 'AUDITOR'],
  coverages: ['ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'OPERATOR', 'AUDITOR'],
  rotations: ['ADMIN', 'HR', 'SUPERVISOR', 'OPERATOR', 'AUDITOR'],
  competitions: ['ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'OPERATOR', 'AUDITOR'],
  employees: ['ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'AUDITOR'],
  requirements: ['ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'AUDITOR'],
  documents: ['ADMIN', 'HR', 'SUPERVISOR', 'OPERATOR', 'AUDITOR'],
  rag: ['ADMIN', 'HR', 'AUDITOR'],
  ai: ['ADMIN', 'HR', 'AUDITOR'],
  infrastructure: ['ADMIN', 'AUDITOR'],
  audit: ['ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'AUDITOR'],
  reports: ['ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'AUDITOR'],
  settings: ['ADMIN', 'HR'],
};

export function canAccessSection(role: AppRole, section: AppSection): boolean {
  return access[section].includes(role);
}

export function allowedSections(role: AppRole): AppSection[] {
  return (Object.keys(access) as AppSection[]).filter((section) => canAccessSection(role, section));
}

export function canMutateOperations(role: AppRole): boolean {
  return ['ADMIN', 'HR', 'SUPERVISOR', 'OPERATOR'].includes(role);
}

export function canAdministerConfiguration(role: AppRole): boolean {
  return role === 'ADMIN' || role === 'HR';
}

export function canManageCompetition(role: AppRole): boolean {
  return role === 'ADMIN' || role === 'HR' || role === 'COMMITTEE';
}
