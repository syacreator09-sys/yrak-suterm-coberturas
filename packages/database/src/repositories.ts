import type { CoverageCaseId, EmployeeId, GroupId, LevelId, OrganizationId } from '@yrak/domain';

export interface DbEmployeeRow { id: string; organization_id: string; group_id: string; base_level_id: string; employee_number: string; name: string; email: string | null; active: number }

export class EmployeeRepository {
  constructor(private readonly db: D1Database) {}

  async getById(organizationId: OrganizationId, employeeId: EmployeeId): Promise<DbEmployeeRow | null> {
    return this.db.prepare('SELECT * FROM employees WHERE organization_id = ? AND id = ?').bind(organizationId, employeeId).first<DbEmployeeRow>();
  }

  async listBySourceLevel(organizationId: OrganizationId, groupId: GroupId, levelId: LevelId): Promise<DbEmployeeRow[]> {
    const result = await this.db.prepare('SELECT * FROM employees WHERE organization_id = ? AND group_id = ? AND base_level_id = ? AND active = 1 ORDER BY employee_number').bind(organizationId, groupId, levelId).all<DbEmployeeRow>();
    return result.results ?? [];
  }
}

export class CoverageCaseRepository {
  constructor(private readonly db: D1Database) {}

  async getById(organizationId: OrganizationId, id: CoverageCaseId): Promise<Record<string, unknown> | null> {
    return this.db.prepare('SELECT * FROM coverage_cases WHERE organization_id = ? AND id = ?').bind(organizationId, id).first<Record<string, unknown>>();
  }
}
