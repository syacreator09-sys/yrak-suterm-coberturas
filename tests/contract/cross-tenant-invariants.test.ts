import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  new URL('../../migrations/0013_cross_tenant_integrity.sql', import.meta.url),
  'utf8',
);

describe('cross-tenant database invariants', () => {
  it('guards employee, user, requirement and evidence ownership', () => {
    expect(sql).toContain('employees_scope_insert');
    expect(sql).toContain('app_users_employee_scope_insert');
    expect(sql).toContain('target_level_requirements_scope_insert');
    expect(sql).toContain('employee_requirements_scope_insert');
  });

  it('requires an immediate authorized level transition', () => {
    expect(sql).toContain('transition must use immediate lower level in same group');
    expect(sql).toContain('temporary_assignments_integrity_insert');
    expect(sql).toContain('rotation_pools_integrity_insert');
  });
});
