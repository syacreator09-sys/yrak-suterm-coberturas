import { defaultCoveragePolicy, determineCoverageProcess, DomainError } from '@yrak/domain';
import { appendAudit } from '../audit.js';
import type { AuthenticatedUser, Env } from '../types.js';
import { calculateCoverageDuration } from './coverage-duration-service.js';
import {
  initializeSafeCompetitionCase,
  initializeSafeRotationCase,
} from './coverage-initialization-safe.js';
import type { CreateCoverageInput } from './coverage-creation-v2.js';

interface EmployeeRow {
  id: string;
  organization_id: string;
  group_id: string;
  base_level_id: string;
  active: number;
}

export async function createSafeCoverage(
  env: Env,
  user: AuthenticatedUser,
  correlationId: string,
  input: CreateCoverageInput,
): Promise<Record<string, unknown>> {
  const employee = await env.DB.prepare(
    `SELECT id, organization_id, group_id,
      base_level_id, active FROM employees WHERE id = ?`,
  )
    .bind(input.absentEmployeeId)
    .first<EmployeeRow>();
  if (!employee || employee.active !== 1 || employee.organization_id !== user.organizationId) {
    throw new DomainError('ABSENT_EMPLOYEE_NOT_FOUND', 'No existe la persona ausente');
  }
  const privileged = user.roles.some((role) => ['ADMIN', 'HR'].includes(role));
  if (!privileged && (user.groups.length === 0 || !user.groups.includes(employee.group_id))) {
    throw new DomainError('GROUP_SCOPE_FORBIDDEN', 'No tienes autorización sobre este grupo');
  }

  const existingAbsence = await env.DB.prepare(
    `SELECT id FROM absences
    WHERE employee_id = ? AND status <> 'CANCELLED'
      AND starts_at <= ? AND ends_at >= ? LIMIT 1`,
  )
    .bind(employee.id, input.endsAt, input.startsAt)
    .first<{ id: string }>();
  if (existingAbsence) {
    throw new DomainError(
      'ABSENCE_OVERLAP',
      'La persona ausente ya tiene otro periodo registrado que se traslapa',
      { absenceId: existingAbsence.id },
    );
  }

  const duration = await calculateCoverageDuration(env, {
    organizationId: user.organizationId,
    employeeId: employee.id,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
  });
  const processType = determineCoverageProcess(duration.durationDays, {
    ...defaultCoveragePolicy,
    dayCountingMode: duration.mode,
  });
  const transition = await env.DB.prepare(
    `SELECT source_level_id, target_level_id
    FROM level_transitions WHERE group_id = ? AND target_level_id = ? AND active = 1`,
  )
    .bind(employee.group_id, employee.base_level_id)
    .first<{ source_level_id: string; target_level_id: string }>();
  if (!transition) {
    throw new DomainError(
      'NO_AUTHORIZED_LEVEL_TRANSITION',
      'No existe nivel inmediato inferior autorizado para cubrir la vacante',
    );
  }
  if (processType === 'COMPETITION' && !input.competition) {
    throw new DomainError(
      'COMPETITION_DETAILS_REQUIRED',
      'Una cobertura de 6 días o más requiere fechas de registro y examen',
      { durationDays: duration.durationDays, countedDates: duration.countedDates },
    );
  }

  const absenceId = crypto.randomUUID();
  const caseId = crypto.randomUUID();
  const folio = `YR-${new Date().getUTCFullYear()}-${caseId.slice(0, 8).toUpperCase()}`;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO absences (
      id, employee_id, group_id, level_id, reason, starts_at, ends_at,
      status, source, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?)`,
    ).bind(
      absenceId,
      employee.id,
      employee.group_id,
      employee.base_level_id,
      input.reason,
      input.startsAt,
      input.endsAt,
      input.source,
      user.id,
    ),
    env.DB.prepare(
      `INSERT INTO coverage_cases (
      id, folio, absence_id, group_id, vacant_level_id, starts_at, ends_at,
      duration_days, process_type, status, rule_version, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_VALIDATION', 'YR-1.0.0', ?)`,
    ).bind(
      caseId,
      folio,
      absenceId,
      employee.group_id,
      employee.base_level_id,
      input.startsAt,
      input.endsAt,
      duration.durationDays,
      processType,
      user.id,
    ),
    ...duration.countedDates.map((date) =>
      env.DB.prepare(
        `INSERT INTO coverage_counted_days (
        coverage_case_id, counted_date, counting_mode, source
      ) VALUES (?, ?, ?, ?)`,
      ).bind(caseId, date, duration.mode, duration.source),
    ),
  ]);

  try {
    const common = {
      caseId,
      sourceLevelId: transition.source_level_id,
      targetLevelId: transition.target_level_id,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    };
    const initialization =
      processType === 'ROTATION'
        ? {
            rotation: await initializeSafeRotationCase(env, user, correlationId, {
              ...common,
              groupId: employee.group_id,
            }),
          }
        : {
            competition: await initializeSafeCompetitionCase(env, user, correlationId, {
              ...common,
              ...input.competition!,
            }),
          };
    await appendAudit(env, {
      organizationId: user.organizationId,
      actor: user,
      entityType: 'COVERAGE_CASE',
      entityId: caseId,
      action: 'CREATED_WITH_AVAILABILITY_VALIDATION',
      newValue: {
        folio,
        durationDays: duration.durationDays,
        countingMode: duration.mode,
        countedDates: duration.countedDates,
        processType,
      },
      ruleApplied: 'YR-1.0.0',
      correlationId,
    });
    return {
      caseId,
      folio,
      processType,
      durationDays: duration.durationDays,
      countingMode: duration.mode,
      countedDates: duration.countedDates,
      ...initialization,
    };
  } catch (error) {
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE coverage_cases SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?",
      ).bind(caseId),
      env.DB.prepare("UPDATE absences SET status = 'CANCELLED' WHERE id = ?").bind(absenceId),
    ]);
    throw error;
  }
}
