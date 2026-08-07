import type { AssignmentStatus, CoverageCaseStatus, CoverageProcessType, DayCountingMode } from './enums.js';

export type Brand<T, B extends string> = T & { readonly __brand: B };
export type OrganizationId = Brand<string, 'OrganizationId'>;
export type GroupId = Brand<string, 'GroupId'>;
export type LevelId = Brand<string, 'LevelId'>;
export type EmployeeId = Brand<string, 'EmployeeId'>;
export type CoverageCaseId = Brand<string, 'CoverageCaseId'>;
export type AssignmentId = Brand<string, 'AssignmentId'>;
export type RotationPoolId = Brand<string, 'RotationPoolId'>;
export type CompetitionId = Brand<string, 'CompetitionId'>;
export type RequirementId = Brand<string, 'RequirementId'>;

export interface DateRange { start: string; end: string }

export interface Employee {
  id: EmployeeId;
  organizationId: OrganizationId;
  groupId: GroupId;
  employeeNumber: string;
  name: string;
  email?: string;
  baseLevelId: LevelId;
  seniorityDate?: string;
  active: boolean;
}

export interface CoveragePolicyConfig {
  shortCoverageMaximumDays: number;
  longCoverageMinimumDays: number;
  dayCountingMode: DayCountingMode;
  rejectionConsumesTurn: boolean;
}

export interface CoverageCase {
  id: CoverageCaseId;
  organizationId: OrganizationId;
  groupId: GroupId;
  targetLevelId: LevelId;
  period: DateRange;
  effectiveDays: number;
  processType: CoverageProcessType;
  status: CoverageCaseStatus;
  ruleVersion: string;
  version: number;
}

export interface TemporaryAssignment {
  id: AssignmentId;
  coverageCaseId: CoverageCaseId;
  employeeId: EmployeeId;
  baseLevelId: LevelId;
  targetLevelId: LevelId;
  period: DateRange;
  status: AssignmentStatus;
  returnedAt?: string;
}
