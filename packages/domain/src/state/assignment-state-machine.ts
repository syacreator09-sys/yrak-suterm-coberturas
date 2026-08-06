import type { AssignmentStatus } from '../enums.js';
import { InvalidTransitionError } from '../errors.js';

const allowedTransitions: Readonly<Record<AssignmentStatus, readonly AssignmentStatus[]>> = {
  PROPOSED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['SCHEDULED', 'ACTIVE', 'CANCELLED'],
  SCHEDULED: ['ACTIVE', 'CANCELLED', 'REPLACED'],
  ACTIVE: ['COMPLETED', 'CANCELLED', 'REPLACED'],
  COMPLETED: [],
  CANCELLED: [],
  REPLACED: [],
};

export function assertAssignmentTransition(from: AssignmentStatus, to: AssignmentStatus): void {
  if (!allowedTransitions[from].includes(to)) {
    throw new InvalidTransitionError('temporary_assignment', from, to);
  }
}
