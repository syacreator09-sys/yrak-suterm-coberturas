import type { Employee, EmployeeId, GroupId, LevelId } from '@yrak/domain';
import type { D1DatabaseLike } from './client.js';

interface EmployeeRow {
  id: string;
  employee_number: string;
  name: string;
  email: string | null;
  group_id: string;
  base_level_id: string;
  active: number;
  seniority_date: string;
}

function mapEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id as EmployeeId,
    employeeNumber: row.employee_number,
    name: row.name,
    email: row.email,
    groupId: row.group_id as GroupId,
    baseLevelId: row.base_level_id as LevelId,
    active: row.active === 1,
    seniorityDate: row.seniority_date,
  };
}

export class D1EmployeeRepository {
  public constructor(private readonly db: D1DatabaseLike) {}

  public async getById(id: EmployeeId): Promise<Employee | null> {
    const row = await this.db
      .prepare('SELECT id, employee_number, name, email, group_id, base_level_id, active, seniority_date FROM employees WHERE id = ?')
      .bind(id)
      .first<EmployeeRow>();
    return row ? mapEmployee(row) : null;
  }

  public async listBySourceLevel(
    groupId: GroupId,
    sourceLevelId: LevelId,
  ): Promise<Employee[]> {
    const result = await this.db
      .prepare('SELECT id, employee_number, name, email, group_id, base_level_id, active, seniority_date FROM employees WHERE group_id = ? AND base_level_id = ? AND active = 1 ORDER BY seniority_date ASC, employee_number ASC')
      .bind(groupId, sourceLevelId)
      .all<EmployeeRow>();
    return (result.results ?? []).map(mapEmployee);
  }
}
