declare const brand: unique symbol;

export type Brand<T, Name extends string> = T & { readonly [brand]: Name };

export type OrganizationId = Brand<string, 'OrganizationId'>;
export type GroupId = Brand<string, 'GroupId'>;
export type LevelId = Brand<string, 'LevelId'>;
export type EmployeeId = Brand<string, 'EmployeeId'>;
export type RequirementId = Brand<string, 'RequirementId'>;
export type CoverageCaseId = Brand<string, 'CoverageCaseId'>;
export type AssignmentId = Brand<string, 'AssignmentId'>;
export type RotationPoolId = Brand<string, 'RotationPoolId'>;
export type CompetitionId = Brand<string, 'CompetitionId'>;
export type AuditEventId = Brand<string, 'AuditEventId'>;

export function asId<T extends string>(value: string): Brand<string, T> {
  if (value.trim().length === 0) {
    throw new Error('El identificador no puede estar vacío');
  }
  return value as Brand<string, T>;
}
