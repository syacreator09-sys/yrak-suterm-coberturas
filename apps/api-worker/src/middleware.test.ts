import { describe, expect, it } from 'vitest';
import { hasOrganizationWideRead, isCrossSiteMutation } from './middleware.js';

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

describe('isCrossSiteMutation', () => {
  it('rejects cross-site state-changing browser requests', () => {
    expect(isCrossSiteMutation('POST', 'cross-site')).toBe(true);
    expect(isCrossSiteMutation('PATCH', 'cross-site')).toBe(true);
    expect(isCrossSiteMutation('DELETE', 'cross-site')).toBe(true);
  });

  it('allows safe methods and trusted/non-browser clients', () => {
    expect(isCrossSiteMutation('GET', 'cross-site')).toBe(false);
    expect(isCrossSiteMutation('HEAD', 'cross-site')).toBe(false);
    expect(isCrossSiteMutation('OPTIONS', 'cross-site')).toBe(false);
    expect(isCrossSiteMutation('POST', 'same-origin')).toBe(false);
    expect(isCrossSiteMutation('POST', 'same-site')).toBe(false);
    expect(isCrossSiteMutation('POST', undefined)).toBe(false);
  });
});
