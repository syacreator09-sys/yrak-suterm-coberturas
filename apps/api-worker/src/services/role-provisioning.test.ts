import { describe, expect, it } from 'vitest';
import { canProvisionRole } from './role-provisioning.js';

describe('canProvisionRole', () => {
  it('allows ADMIN to provision any supported role', () => {
    for (const role of ['ADMIN','HR','SUPERVISOR','COMMITTEE','OPERATOR','EMPLOYEE','AUDITOR'] as const) {
      expect(canProvisionRole('ADMIN', role)).toBe(true);
    }
  });

  it('prevents HR from creating ADMIN or AUDITOR identities', () => {
    expect(canProvisionRole('HR', 'ADMIN')).toBe(false);
    expect(canProvisionRole('HR', 'AUDITOR')).toBe(false);
    expect(canProvisionRole('HR', 'HR')).toBe(true);
    expect(canProvisionRole('HR', 'SUPERVISOR')).toBe(true);
    expect(canProvisionRole('HR', 'EMPLOYEE')).toBe(true);
  });

  it('denies provisioning to non-admin operational roles', () => {
    expect(canProvisionRole('SUPERVISOR', 'EMPLOYEE')).toBe(false);
    expect(canProvisionRole('COMMITTEE', 'EMPLOYEE')).toBe(false);
  });
});
