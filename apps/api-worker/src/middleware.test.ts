import { describe, expect, it } from 'vitest';
import { hasOrganizationWideRead } from './middleware.js';

describe('hasOrganizationWideRead', () => {
  it('allows organization-wide read only to ADMIN, HR and AUDITOR', () => {
    expect(hasOrganizationWideRead('ADMIN')).toBe(true);
    expect(hasOrganizationWideRead('HR')).toBe(true);
    expect(hasOrganizationWideRead('AUDITOR')).toBe(true);
  });

  it('keeps operational roles scoped to assigned groups', () => {
    expect(hasOrganizationWideRead('SUPERVISOR')).toBe(false);
    expect(hasOrganizationWideRead('COMMITTEE')).toBe(false);
    expect(hasOrganizationWideRead('OPERATOR')).toBe(false);
    expect(hasOrganizationWideRead('EMPLOYEE')).toBe(false);
  });
});
