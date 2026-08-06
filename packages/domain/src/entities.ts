import type {
  AssignmentId,
  CoverageCaseId,
  EmployeeId,
  GroupId,
  LevelId,
  OrganizationId,
  RequirementId,
} from './ids.js';
import type {
  AssignmentStatus,
  CoverageCaseStatus,
  CoverageProcessType,
  RequirementEvaluationStatus,
} from './enums.js';

export interface DateRange {
  startsAt: string;
  endsAt: string;
}

export interface Organization {
  id: OrganizationId;
  name: string;
  timezone: string;
}

export interface Group {
  id: GroupId;
  organizationId: OrganizationId;
  name: string;
  active: boolean;
}

export interface Level {
  id: LevelId;
  groupId: GroupId;
  number: number;
  name: string;
  rankOrder: number;
  active: boolean;
}

export interface LevelTransition {
  sourceLevelId: LevelId;
  targetLevelId: LevelId;
  active: boolean;
}

export interface Employee {
  id: EmployeeId;
  employeeNumber: string;
  name: string;
  email: string | null;
  groupId: GroupId;
  baseLevelId: LevelId;
  active: boolean;
  seniorityDate: string;
}

export interface CoverageCase {
  id: CoverageCaseId;
  groupId: GroupId;
  vacantLevelId: LevelId;
  startsAt: string;
  endsAt: string;
  durationDays: number;
  processType: CoverageProcessType;
  status: CoverageCaseStatus;
  version: number;
}

export interface TemporaryAssignment {
  id: AssignmentId;
  coverageCaseId: CoverageCaseId;
  employeeId: EmployeeId;
  baseLevelId: LevelId;
  targetLevelId: LevelId;
  startsAt: string;
  endsAt: string;
  status: AssignmentStatus;
  chainOrder: number;
  returnedAt: string | null;
}

export interface RequirementEvaluation {
  requirementId: RequirementId;
  status: RequirementEvaluationStatus;
  validUntil: string | null;
  evidenceId: string | null;
}
