import type { DateRange, TemporaryAssignment } from '@yrak/domain';

export function rangesOverlap(left: DateRange, right: DateRange): boolean {
  return new Date(left.startsAt).getTime() <= new Date(right.endsAt).getTime()
    && new Date(right.startsAt).getTime() <= new Date(left.endsAt).getTime();
}

export function hasAssignmentConflict(
  existing: readonly TemporaryAssignment[],
  employeeId: string,
  period: DateRange,
): boolean {
  return existing.some(
    (assignment) =>
      assignment.employeeId === employeeId
      && ['APPROVED', 'SCHEDULED', 'ACTIVE'].includes(assignment.status)
      && rangesOverlap(assignment, period),
  );
}
