export type CoverageProcessType = 'ROTATION' | 'COMPETITION';
export type DayCountingMode = 'CALENDAR_DAYS' | 'WORKING_DAYS' | 'SHIFTS';

export type CoverageCaseStatus =
  | 'DRAFT'
  | 'PENDING_INFORMATION'
  | 'PENDING_VALIDATION'
  | 'CANDIDATES_CALCULATED'
  | 'PENDING_APPROVAL'
  | 'ROTATION_ASSIGNED'
  | 'COMPETITION_OPEN'
  | 'EXAM_PENDING'
  | 'RESULT_PENDING'
  | 'AWARDED'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

export type AssignmentStatus =
  'PROPOSED' | 'APPROVED' | 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'REPLACED';

export type AvailabilityStatus =
  'AVAILABLE' | 'UNAVAILABLE' | 'RESERVED' | 'ASSIGNED' | 'SUSPENDED';

export type RequirementEvaluationStatus =
  'COMPLIANT' | 'MISSING' | 'EXPIRED' | 'PENDING' | 'REJECTED' | 'NOT_APPLICABLE';
