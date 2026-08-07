import type { AssignmentStatus, CoverageCaseStatus } from './enums.js';
import { InvalidStateTransitionError } from './errors.js';

const COVERAGE_TRANSITIONS: Record<CoverageCaseStatus, ReadonlySet<CoverageCaseStatus>> = {
  DRAFT: new Set(['PENDING_INFORMATION', 'PENDING_VALIDATION', 'CANCELLED']),
  PENDING_INFORMATION: new Set(['PENDING_VALIDATION', 'CANCELLED']),
  PENDING_VALIDATION: new Set(['CANDIDATES_CALCULATED', 'COMPETITION_OPEN', 'CANCELLED']),
  CANDIDATES_CALCULATED: new Set(['PENDING_APPROVAL', 'CANCELLED']),
  PENDING_APPROVAL: new Set(['SCHEDULED', 'COMPETITION_OPEN', 'CANCELLED']),
  COMPETITION_OPEN: new Set(['EXAM_PENDING', 'CANCELLED']),
  EXAM_PENDING: new Set(['RESULT_PENDING', 'CANCELLED']),
  RESULT_PENDING: new Set(['AWARDED', 'DISPUTED', 'CANCELLED']),
  AWARDED: new Set(['SCHEDULED', 'DISPUTED', 'CANCELLED']),
  SCHEDULED: new Set(['ACTIVE', 'CANCELLED']),
  ACTIVE: new Set(['COMPLETED', 'CANCELLED', 'DISPUTED']),
  COMPLETED: new Set([]),
  CANCELLED: new Set([]),
  DISPUTED: new Set(['RESULT_PENDING', 'AWARDED', 'CANCELLED']),
};

const ASSIGNMENT_TRANSITIONS: Record<AssignmentStatus, ReadonlySet<AssignmentStatus>> = {
  PROPOSED: new Set(['APPROVED', 'CANCELLED']),
  APPROVED: new Set(['SCHEDULED', 'CANCELLED']),
  SCHEDULED: new Set(['ACTIVE', 'CANCELLED', 'REPLACED']),
  ACTIVE: new Set(['COMPLETED', 'CANCELLED', 'REPLACED']),
  COMPLETED: new Set([]),
  CANCELLED: new Set([]),
  REPLACED: new Set([]),
};

export function assertCoverageTransition(from: CoverageCaseStatus, to: CoverageCaseStatus): void {
  if (!COVERAGE_TRANSITIONS[from].has(to)) throw new InvalidStateTransitionError('coverage_case', from, to);
}

export function assertAssignmentTransition(from: AssignmentStatus, to: AssignmentStatus): void {
  if (!ASSIGNMENT_TRANSITIONS[from].has(to)) throw new InvalidStateTransitionError('temporary_assignment', from, to);
}
