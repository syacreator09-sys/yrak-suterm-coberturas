import type { Env } from '../types.js';

export interface AvailabilityConflict {
  code: 'ABSENCE_OVERLAP' | 'ASSIGNMENT_OVERLAP';
  entityId: string;
  startsAt: string;
  endsAt: string;
}

export async function findAvailabilityConflicts(
  env: Env,
  input: {
    employeeId: string;
    startsAt: string;
    endsAt: string;
    excludeCoverageCaseId?: string;
  },
): Promise<AvailabilityConflict[]> {
  const absenceResult = await env.DB.prepare(`SELECT id, starts_at, ends_at
    FROM absences
    WHERE employee_id = ?
      AND status <> 'CANCELLED'
      AND starts_at <= ?
      AND ends_at >= ?
    ORDER BY starts_at`)
    .bind(input.employeeId, input.endsAt, input.startsAt)
    .all<{ id: string; starts_at: string; ends_at: string }>();

  const assignmentResult = input.excludeCoverageCaseId
    ? await env.DB.prepare(`SELECT id, starts_at, ends_at
        FROM temporary_assignments
        WHERE employee_id = ?
          AND coverage_case_id <> ?
          AND status IN ('PROPOSED','APPROVED','SCHEDULED','ACTIVE')
          AND starts_at <= ?
          AND ends_at >= ?
        ORDER BY starts_at`)
        .bind(
          input.employeeId,
          input.excludeCoverageCaseId,
          input.endsAt,
          input.startsAt,
        )
        .all<{ id: string; starts_at: string; ends_at: string }>()
    : await env.DB.prepare(`SELECT id, starts_at, ends_at
        FROM temporary_assignments
        WHERE employee_id = ?
          AND status IN ('PROPOSED','APPROVED','SCHEDULED','ACTIVE')
          AND starts_at <= ?
          AND ends_at >= ?
        ORDER BY starts_at`)
        .bind(input.employeeId, input.endsAt, input.startsAt)
        .all<{ id: string; starts_at: string; ends_at: string }>();

  return [
    ...(absenceResult.results ?? []).map((row) => ({
      code: 'ABSENCE_OVERLAP' as const,
      entityId: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    })),
    ...(assignmentResult.results ?? []).map((row) => ({
      code: 'ASSIGNMENT_OVERLAP' as const,
      entityId: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    })),
  ];
}

export async function isEmployeeAvailable(
  env: Env,
  input: {
    employeeId: string;
    startsAt: string;
    endsAt: string;
    excludeCoverageCaseId?: string;
  },
): Promise<boolean> {
  return (await findAvailabilityConflicts(env, input)).length === 0;
}
