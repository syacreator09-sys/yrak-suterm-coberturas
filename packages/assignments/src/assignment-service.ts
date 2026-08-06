import { DomainError } from '@yrak/domain';
import type { Employee, TemporaryAssignment } from '@yrak/domain';

export function assertBaseLevelUnchanged(
  employee: Employee,
  assignment: TemporaryAssignment,
): void {
  if (employee.id !== assignment.employeeId) {
    throw new DomainError('ASSIGNMENT_EMPLOYEE_MISMATCH', 'La asignación pertenece a otra persona');
  }
  if (employee.baseLevelId !== assignment.baseLevelId) {
    throw new DomainError('BASE_LEVEL_MUTATION_DETECTED', 'El nivel base no coincide con la asignación', {
      employeeId: employee.id,
      employeeBaseLevelId: employee.baseLevelId,
      assignmentBaseLevelId: assignment.baseLevelId,
    });
  }
}
