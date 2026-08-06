import { DomainError } from '@yrak/domain';
import { evaluateEligibility } from '@yrak/eligibility';
import { appendAudit } from '../audit.js';
import type { AuthenticatedUser, Env } from '../types.js';
import { findAvailabilityConflicts } from './availability-service.js';
import { ensureRotationPool } from './coverage-initialization-service.js';

interface QueueRow {
  employee_id: string;
  queue_position: number;
  availability: 'AVAILABLE' | 'UNAVAILABLE' | 'RESERVED' | 'ASSIGNED' | 'SUSPENDED';
}

export async function initializeSafeRotationCase(
  env: Env,
  user: AuthenticatedUser,
  correlationId: string,
  input: {
    caseId: string;
    groupId: string;
    sourceLevelId: string;
    targetLevelId: string;
    startsAt: string;
    endsAt: string;
  },
): Promise<{ employeeId: string; approvalId: string; assignmentId: string; poolId: string }> {
  const poolId = await ensureRotationPool(
    env,
    input.groupId,
    input.sourceLevelId,
    input.targetLevelId,
  );
  const queue = await env.DB.prepare(`SELECT employee_id, queue_position, availability
    FROM rotation_queue_entries WHERE pool_id = ? ORDER BY queue_position`)
    .bind(poolId)
    .all<QueueRow>();

  const skipped: Array<{ employeeId: string; position: number; reason: string }> = [];
  let selected: QueueRow | null = null;
  for (const candidate of queue.results ?? []) {
    if (candidate.availability !== 'AVAILABLE') continue;
    const conflicts = await findAvailabilityConflicts(env, {
      employeeId: candidate.employee_id,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      excludeCoverageCaseId: input.caseId,
    });
    if (conflicts.length > 0) {
      skipped.push({
        employeeId: candidate.employee_id,
        position: candidate.queue_position,
        reason: conflicts.map((conflict) => conflict.code).join(','),
      });
      continue;
    }
    const reservation = await env.GROUP_COORDINATOR.getByName(input.groupId).reserve({
      employeeId: candidate.employee_id,
      coverageCaseId: input.caseId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    if (reservation.reserved) {
      selected = candidate;
      break;
    }
    skipped.push({
      employeeId: candidate.employee_id,
      position: candidate.queue_position,
      reason: 'CONCURRENT_RESERVATION',
    });
  }
  if (!selected) {
    throw new DomainError(
      'NO_AVAILABLE_ROTATION_CANDIDATE',
      'No hay candidatos disponibles para todo el periodo',
      { skipped },
    );
  }

  const assignmentId = crypto.randomUUID();
  const approvalId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO temporary_assignments (
      id, coverage_case_id, employee_id, base_level_id, target_level_id, chain_order,
      starts_at, ends_at, status
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, 'PROPOSED')`)
      .bind(
        assignmentId,
        input.caseId,
        selected.employee_id,
        input.sourceLevelId,
        input.targetLevelId,
        input.startsAt,
        input.endsAt,
      ),
    env.DB.prepare(`UPDATE rotation_queue_entries
      SET availability = 'RESERVED', version = version + 1, updated_at = datetime('now')
      WHERE pool_id = ? AND employee_id = ? AND availability = 'AVAILABLE'`)
      .bind(poolId, selected.employee_id),
    ...skipped.map((candidate) =>
      env.DB.prepare(`INSERT INTO rotation_events (
        id, pool_id, employee_id, coverage_case_id, event_type,
        previous_position, new_position, reason, created_by
      ) VALUES (?, ?, ?, ?, 'SKIPPED', ?, ?, ?, ?)`)
        .bind(
          crypto.randomUUID(),
          poolId,
          candidate.employeeId,
          input.caseId,
          candidate.position,
          candidate.position,
          candidate.reason,
          user.id,
        ),
    ),
    env.DB.prepare(`INSERT INTO rotation_events (
      id, pool_id, employee_id, coverage_case_id, event_type,
      previous_position, new_position, reason, created_by
    ) VALUES (?, ?, ?, ?, 'RESERVED', ?, ?, 'Candidato disponible reservado', ?)`)
      .bind(
        crypto.randomUUID(),
        poolId,
        selected.employee_id,
        input.caseId,
        selected.queue_position,
        selected.queue_position,
        user.id,
      ),
    env.DB.prepare(`INSERT INTO approvals (
      id, entity_type, entity_id, action, status, requested_by
    ) VALUES (?, 'COVERAGE_CASE', ?, 'APPROVE_ROTATION_ASSIGNMENT', 'PENDING', ?)`)
      .bind(approvalId, input.caseId, user.id),
    env.DB.prepare(`UPDATE coverage_cases
      SET status = 'PENDING_APPROVAL', version = version + 1, updated_at = datetime('now')
      WHERE id = ?`)
      .bind(input.caseId),
  ]);
  await appendAudit(env, {
    organizationId: user.organizationId,
    actor: user,
    entityType: 'COVERAGE_CASE',
    entityId: input.caseId,
    action: 'SAFE_ROTATION_CANDIDATE_RESERVED',
    newValue: {
      employeeId: selected.employee_id,
      assignmentId,
      poolId,
      skipped,
    },
    ruleApplied: 'YR-1.0.0:ROTATION_1_TO_5',
    correlationId,
  });
  return { employeeId: selected.employee_id, approvalId, assignmentId, poolId };
}

export async function initializeSafeCompetitionCase(
  env: Env,
  user: AuthenticatedUser,
  correlationId: string,
  input: {
    caseId: string;
    sourceLevelId: string;
    targetLevelId: string;
    startsAt: string;
    endsAt: string;
    registrationStartsAt: string;
    registrationEndsAt: string;
    examAt: string;
    minimumScore?: number;
    tieBreakers?: Array<{ type: 'CRITICAL_SECTION' | 'SENIORITY' | 'EMPLOYEE_ID' }>;
  },
): Promise<{ competitionId: string; eligibleCount: number; ineligibleCount: number }> {
  const competitionId = crypto.randomUUID();
  const policy = await env.DB.prepare(`SELECT default_minimum_exam_score,
      default_tie_breaker_rules_json FROM organization_policies WHERE organization_id = ?`)
    .bind(user.organizationId)
    .first<{ default_minimum_exam_score: number; default_tie_breaker_rules_json: string }>();
  const tieBreakers =
    input.tieBreakers ??
    (JSON.parse(
      policy?.default_tie_breaker_rules_json ??
        '[{"type":"SENIORITY"},{"type":"EMPLOYEE_ID"}]',
    ) as Array<{ type: 'CRITICAL_SECTION' | 'SENIORITY' | 'EMPLOYEE_ID' }>);
  const minimumScore = input.minimumScore ?? policy?.default_minimum_exam_score ?? 0;
  const required = await env.DB.prepare(`SELECT requirement_id, valid_for_entire_coverage
    FROM target_level_requirements WHERE target_level_id = ? AND mandatory = 1`)
    .bind(input.targetLevelId)
    .all<{ requirement_id: string; valid_for_entire_coverage: number }>();
  const requiredIds = (required.results ?? []).map((row) => row.requirement_id);
  const requireFullValidity = (required.results ?? []).some(
    (row) => row.valid_for_entire_coverage === 1,
  );
  const employees = await env.DB.prepare(`SELECT id FROM employees
    WHERE base_level_id = ? AND active = 1 ORDER BY seniority_date, employee_number`)
    .bind(input.sourceLevelId)
    .all<{ id: string }>();

  const statements: D1PreparedStatement[] = [];
  let eligibleCount = 0;
  let ineligibleCount = 0;
  for (const employee of employees.results ?? []) {
    const [conflicts, evaluations] = await Promise.all([
      findAvailabilityConflicts(env, {
        employeeId: employee.id,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        excludeCoverageCaseId: input.caseId,
      }),
      env.DB.prepare(`SELECT requirement_id, status, valid_until, evidence_attachment_id
        FROM employee_requirements WHERE employee_id = ?`)
        .bind(employee.id)
        .all<{
          requirement_id: string;
          status: never;
          valid_until: string | null;
          evidence_attachment_id: string | null;
        }>(),
    ]);
    const requirementResult = evaluateEligibility({
      employeeId: employee.id as never,
      requiredRequirementIds: requiredIds as never,
      evaluations: (evaluations.results ?? []).map((row) => ({
        requirementId: row.requirement_id as never,
        status: row.status,
        validUntil: row.valid_until,
        evidenceId: row.evidence_attachment_id,
      })),
      coverageStartsAt: input.startsAt,
      coverageEndsAt: input.endsAt,
      mustRemainValidForEntireCoverage: requireFullValidity,
    });
    const eligible = requirementResult.eligible && conflicts.length === 0;
    eligible ? eligibleCount++ : ineligibleCount++;
    statements.push(
      env.DB.prepare(`INSERT INTO competition_candidates (
        id, competition_id, employee_id, eligibility_status, eligibility_details_json
      ) VALUES (?, ?, ?, ?, ?)`)
        .bind(
          crypto.randomUUID(),
          competitionId,
          employee.id,
          eligible ? 'ELIGIBLE' : 'INELIGIBLE',
          JSON.stringify({
            ...requirementResult,
            eligible,
            availabilityConflicts: conflicts,
          }),
        ),
    );
  }

  await env.DB.batch([
    env.DB.prepare(`INSERT INTO competitions (
      id, coverage_case_id, target_level_id, registration_starts_at,
      registration_ends_at, exam_at, minimum_score, tie_breaker_rules_json, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`)
      .bind(
        competitionId,
        input.caseId,
        input.targetLevelId,
        input.registrationStartsAt,
        input.registrationEndsAt,
        input.examAt,
        minimumScore,
        JSON.stringify(tieBreakers),
      ),
    ...statements,
    env.DB.prepare(`UPDATE coverage_cases
      SET status = 'COMPETITION_OPEN', version = version + 1, updated_at = datetime('now')
      WHERE id = ?`)
      .bind(input.caseId),
  ]);
  await appendAudit(env, {
    organizationId: user.organizationId,
    actor: user,
    entityType: 'COMPETITION',
    entityId: competitionId,
    action: 'SAFE_COMPETITION_OPENED',
    newValue: { eligibleCount, ineligibleCount, minimumScore, tieBreakers },
    ruleApplied: 'YR-1.0.0:COMPETITION_6_PLUS',
    correlationId,
  });
  return { competitionId, eligibleCount, ineligibleCount };
}
