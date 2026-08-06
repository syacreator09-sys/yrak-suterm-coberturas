import type { AvailabilityStatus, CoverageCaseId, EmployeeId, RotationPoolId } from '@yrak/domain';

export interface RotationCandidate {
  employeeId: EmployeeId;
  position: number;
  availability: AvailabilityStatus;
  unavailableReason?: string;
}

export interface RotationSelection {
  selected: RotationCandidate;
  skipped: readonly RotationCandidate[];
}

export interface CompleteRotationInput {
  poolId: RotationPoolId;
  employeeId: EmployeeId;
  coverageCaseId: CoverageCaseId;
  consumedTurn: boolean;
}
