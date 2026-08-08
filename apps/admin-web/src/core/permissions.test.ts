import { describe, expect, it } from 'vitest';
import { canAccessSection } from './permissions.js';

describe('Control Center permissions', () => {
  it('gives ADMIN full Control Center access', () => {
    for (const section of ['overview','coverages','rotations','competitions','employees','requirements','documents','rag','ai','infrastructure','audit','reports','settings'] as const) {
      expect(canAccessSection('ADMIN', section)).toBe(true);
    }
  });

  it('keeps configuration and infrastructure away from operational roles', () => {
    expect(canAccessSection('SUPERVISOR', 'settings')).toBe(false);
    expect(canAccessSection('OPERATOR', 'settings')).toBe(false);
    expect(canAccessSection('COMMITTEE', 'infrastructure')).toBe(false);
  });

  it('keeps EMPLOYEE out of the admin Control Center', () => {
    expect(canAccessSection('EMPLOYEE', 'overview')).toBe(false);
    expect(canAccessSection('EMPLOYEE', 'coverages')).toBe(false);
    expect(canAccessSection('EMPLOYEE', 'audit')).toBe(false);
  });

  it('allows AUDITOR read-oriented views but not settings', () => {
    expect(canAccessSection('AUDITOR', 'overview')).toBe(true);
    expect(canAccessSection('AUDITOR', 'audit')).toBe(true);
    expect(canAccessSection('AUDITOR', 'reports')).toBe(true);
    expect(canAccessSection('AUDITOR', 'settings')).toBe(false);
  });
});
