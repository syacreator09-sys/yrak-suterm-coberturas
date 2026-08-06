import { DomainError } from '@yrak/domain';
import type { TemporaryAssignment } from '@yrak/domain';

export function completeAndReturn(
  assignment: TemporaryAssignment,
  returnedAt: string,
): TemporaryAssignment {
  if (assignment.status !== 'ACTIVE') {
    throw new DomainError('ASSIGNMENT_NOT_ACTIVE', 'Solo una asignación activa puede finalizar');
  }
  return {
    ...assignment,
    status: 'COMPLETED',
    returnedAt,
  };
}
