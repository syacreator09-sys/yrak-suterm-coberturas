import type { CoverageCaseStatus } from '../enums.js';
import { InvalidTransitionError } from '../errors.js';

const allowedTransitions: Readonly<Record<CoverageCaseStatus, readonly CoverageCaseStatus[]>> = {
  DRAFT: ['PENDING_INFORMATION', 'PENDING_VALIDATION', 'CANCELLED'],
  PENDING_INFORMATION: ['PENDING_VALIDATION', 'CANCELLED'],
  PENDING_VALIDATION: ['CANDIDATES_CALCULATED', 'CANCELLED'],
  CANDIDATES_CALCULATED: ['PENDING_APPROVAL', 'COMPETITION_OPEN', 'CANCELLED'],
  PENDING_APPROVAL: ['ROTATION_ASSIGNED', 'AWARDED', 'CANCELLED'],
  ROTATION_ASSIGNED: ['SCHEDULED', 'ACTIVE', 'CANCELLED'],
  COMPETITION_OPEN: ['EXAM_PENDING', 'CANCELLED'],
  EXAM_PENDING: ['RESULT_PENDING', 'CANCELLED'],
  RESULT_PENDING: ['PENDING_APPROVAL', 'DISPUTED', 'CANCELLED'],
  AWARDED: ['SCHEDULED', 'ACTIVE', 'DISPUTED', 'CANCELLED'],
  SCHEDULED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'DISPUTED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: ['PENDING_APPROVAL', 'AWARDED', 'CANCELLED'],
};

export function assertCoverageTransition(from: CoverageCaseStatus, to: CoverageCaseStatus): void {
  if (!allowedTransitions[from].includes(to)) {
    throw new InvalidTransitionError('coverage_case', from, to);
  }
}
