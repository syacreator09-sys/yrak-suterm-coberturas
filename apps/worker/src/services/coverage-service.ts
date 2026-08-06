import {
  countCalendarDays,
  determineCoverageProcess,
  DomainError,
} from '@yrak/domain';
import { evaluateEligibility } from '@yrak/eligibility';
import { selectNextCandidate } from '@yrak/rotation';
import { appendAudit } from '../audit.js';
import type { AuthenticatedUser, Env } from '../types.js';

export interface CreateCoverageInput {
  absentEmployeeId: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  source: 'MANUAL' | 'EMAIL' | 'AUDIO' | 'IMAGE' | 'DOCUMENT' | 'INTEGRATION';
  competition?: {
    registrationStartsAt: string;
    registrationEndsAt: string;
    examAt: string;
    minimumScore?: number;
    tieBreakers?: Array<{ type: 'CRITICAL_SECTION' | 'SENIORITY' | 'EMPLOYEE_ID' }>;
  };
}

interface EmployeeRow {
  id: string;
  organization_id: string;
  group_id: string;
  base_level_id: string;
  active: number;
}

interface TransitionRow {
  source_level_id: string;
  target_level_id: string;
}

async function ensureRotationPool(
  env: Env,
  groupId: string,
  sourceLevelId: string,
  targetLevelId: string,
): Promise<string> {
  const existing = await env.DB.prepare(
    'SELECT id FROM rotation_pools WHERE group_id = ? AND source_level_id = ? AND target_level_id = ? AND active = 1',
  )
    .bind(groupId, sourceLevelId, targetLevelId)
    .first<{ id: string }>();
  if (existing) return existing.id;

  const poolId = crypto.randomUUID();
  const employees = await env.DB.prepare(
    'SELECT id FROM employees WHERE group_id = ? AND base_level_id = ? AND active = 1 ORDER BY seniority_date ASC, employee_number ASC',
  )
    .bind(groupId, sourceLevelId)
    .all<{ id: string }>();
  const statements = [
    env.DB.prepare(
      'INSERT INTO rotation_pools (id, group_id, source_level_id, target_level_id, active) VALUES (?, ?, ?, ?, 1)',
    ).bind(poolId, groupId, sourceLevelId, targetLevelId),
    ...(employees.results ?? []).map((employee, index) =>
      env.DB.prepare(
        "INSERT INTO rotation_queue_entries (id, pool_id, employee_id, queue_position, availability) VALUES (?, ?, ?, ?, 'AVAILABLE')",
      ).bind(crypto.randomUUID(), poolId, employee.id, index + 1),
    ),
  ];
  await env.DB.batch(statements);
  return poolId;
}

async function createRotationAssignment(
  env: Env,
  user: AuthenticatedUser,
  correlationId: string,
  caseId: string,
  groupId: string,
  sourceLevelId: string,
  targetLevelId: string,
  startsAt: string,
  endsAt: string,
): Promise<{ employeeId: string; approvalId: string; assignmentId: string; poolId: string }> {
  const poolId = await ensureRotationPool(env, groupId, sourceLevelId, targetLevelId);
  const queueResult = await env.DB.prepare(
    'SELECT employee_id, queue_position, availability, unavailable_reason FROM rotation_queue_entries WHERE pool_id = ? ORDER BY queue_position ASC',
  )
    .bind(poolId)
    .all<{ employee_id: string; queue_position: number; availability: 'AVAILABLE' | 'UNAVAILABLE' | 'RESERVED' | 'ASSIGNED' | 'SUSPENDED'; unavailable_reason: string | null }>();

  let candidates = (queueResult.results ?? []).map((row) => ({
    employeeId: row.employee_id,
    position: row.queue_position,
    availability: row.availability,
    ...(row.unavailable_reason ? { unavailableReason: row.unavailable_reason } : {}),
  }));
  let selected: ReturnType<typeof selectNextCandidate>['selected'] | null = null;
  while (candidates.some((candidate) => candidate.availability === 'AVAILABLE')) {
    const selection = selectNextCandidate(candidates as never);
    const coordinator = env.GROUP_COORDINATOR.getByName(groupId);
    const reservation = await coordinator.reserve({
      employeeId: selection.selected.employeeId,
      coverageCaseId: caseId,
      startsAt,
      endsAt,
    });
    if (reservation.reserved) {
      selected = selection.selected;
      break;
    }
    candidates = candidates.map((candidate) =>
      candidate.employeeId === selection.selected.employeeId
        ? { ...candidate, availability: 'RESERVED' as const }
        : candidate,
    );
  }
  if (!selected) throw new DomainError('NO_AVAILABLE_ROTATION_CANDIDATE', 'No hay candidatos disponibles');

  const assignmentId = crypto.randomUUID();
  const approvalId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO temporary_assignments (
      id, coverage_case_id, employee_id, base_level_id, target_level_id, chain_order,
      starts_at, ends_at, status
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, 'PROPOSED')`)
      .bind(assignmentId, caseId, selected.employeeId, sourceLevelId, targetLevelId, startsAt, endsAt),
    env.DB.prepare(
      "UPDATE rotation_queue_entries SET availability = 'RESERVED', version = version + 1, updated_at = datetime('now') WHERE pool_id = ? AND employee_id = ? AND availability = 'AVAILABLE'",
    ).bind(poolId, selected.employeeId),
    env.DB.prepare(`INSERT INTO rotation_events (
      id, pool_id, employee_id, coverage_case_id, event_type, previous_position, new_position, reason, created_by
    ) SELECT ?, ?, employee_id, ?, 'RESERVED', queue_position, queue_position, 'Candidato reservado para aprobación', ?
      FROM rotation_queue_entries WHERE pool_id = ? AND employee_id = ?`)
      .bind(crypto.randomUUID(), poolId, caseId, user.id, poolId, selected.employeeId),
    env.DB.prepare(`INSERT INTO approvals (
      id, entity_type, entity_id, action, status, requested_by
    ) VALUES (?, 'COVERAGE_CASE', ?, 'APPROVE_ROTATION_ASSIGNMENT', 'PENDING', ?)`)
      .bind(approvalId, caseId, user.id),
    env.DB.prepare(
      "UPDATE coverage_cases SET status = 'PENDING_APPROVAL', version = version + 1, updated_at = datetime('now') WHERE id = ?",
    ).bind(caseId),
  ]);

  await appendAudit(env, {
    organizationId: user.organizationId,
    actor: user,
    entityType: 'COVERAGE_CASE',
    entityId: caseId,
    action: 'ROTATION_CANDIDATE_RESERVED',
    newValue: { employeeId: selected.employeeId, poolId, assignmentId },
    ruleApplied: 'YR-1.0.0:ROTATION_1_TO_5',
    correlationId,
  });
  return { employeeId: selected.employeeId, approvalId, assignmentId, poolId };
}

async function createCompetition(
  env: Env,
  user: AuthenticatedUser,
  correlationId: string,
  caseId: string,
  sourceLevelId: string,
  targetLevelId: string,
  startsAt: string,
  endsAt: string,
  details: NonNullable<CreateCoverageInput['competition']>,
): Promise<{ competitionId: string; eligibleCount: number; ineligibleCount: number }> {
  const competitionId = crypto.randomUUID();
  const policy = await env.DB.prepare(
    'SELECT default_minimum_exam_score, default_tie_breaker_rules_json FROM organization_policies WHERE organization_id = ?',
  )
    .bind(user.organizationId)
    .first<{ default_minimum_exam_score: number; default_tie_breaker_rules_json: string }>();
  const tieBreakers = details.tieBreakers ?? JSON.parse(policy?.default_tie_breaker_rules_json ?? '[{"type":"SENIORITY"},{"type":"EMPLOYEE_ID"}]');
  const minimumScore = details.minimumScore ?? policy?.default_minimum_exam_score ?? 0;

  const requiredResult = await env.DB.prepare(
    'SELECT requirement_id, valid_for_entire_coverage FROM target_level_requirements WHERE target_level_id = ? AND mandatory = 1',
  )
    .bind(targetLevelId)
    .all<{ requirement_id: string; valid_for_entire_coverage: number }>();
  const requiredIds = (requiredResult.results ?? []).map((row) => row.requirement_id);
  const mustRemainValid = (requiredResult.results ?? []).some((row) => row.valid_for_entire_coverage === 1);
  const employeeResult = await env.DB.prepare(
    'SELECT id FROM employees WHERE base_level_id = ? AND active = 1 ORDER BY seniority_date ASC, employee_number ASC',
  )
    .bind(sourceLevelId)
    .all<{ id: string }>();

  const candidateStatements: D1PreparedStatement[] = [];
  let eligibleCount = 0;
  let ineligibleCount = 0;
  for (const employee of employeeResult.results ?? []) {
    const evaluationsResult = await env.DB.prepare(
      'SELECT requirement_id, status, valid_until, evidence_attachment_id FROM employee_requirements WHERE employee_id = ?',
    )
      .bind(employee.id)
      .all<{ requirement_id: string; status: never; valid_until: string | null; evidence_attachment_id: string | null }>();
    const eligibility = evaluateEligibility({
      employeeId: employee.id as never,
      requiredRequirementIds: requiredIds as never,
      evaluations: (evaluationsResult.results ?? []).map((row) => ({
        requirementId: row.requirement_id as never,
        status: row.status,
        validUntil: row.valid_until,
        evidenceId: row.evidence_attachment_id,
      })),
      coverageStartsAt: startsAt,
      coverageEndsAt: endsAt,
      mustRemainValidForEntireCoverage: mustRemainValid,
    });
    eligibility.eligible ? eligibleCount++ : ineligibleCount++;
    candidateStatements.push(
      env.DB.prepare(`INSERT INTO competition_candidates (
        id, competition_id, employee_id, eligibility_status, eligibility_details_json
      ) VALUES (?, ?, ?, ?, ?)`)
        .bind(
          crypto.randomUUID(),
          competitionId,
          employee.id,
          eligibility.eligible ? 'ELIGIBLE' : 'INELIGIBLE',
          JSON.stringify(eligibility),
        ),
    );
  }

  await env.DB.batch([
    env.DB.prepare(`INSERT INTO competitions (
      id, coverage_case_id, target_level_id, registration_starts_at, registration_ends_at,
      exam_at, minimum_score, tie_breaker_rules_json, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`)
      .bind(
        competitionId,
        caseId,
        targetLevelId,
        details.registrationStartsAt,
        details.registrationEndsAt,
        details.examAt,
        minimumScore,
        JSON.stringify(tieBreakers),
      ),
    ...candidateStatements,
    env.DB.prepare(
      "UPDATE coverage_cases SET status = 'COMPETITION_OPEN', version = version + 1, updated_at = datetime('now') WHERE id = ?",
    ).bind(caseId),
  ]);

  await appendAudit(env, {
    organizationId: user.organizationId,
    actor: user,
    entityType: 'COMPETITION',
    entityId: competitionId,
    action: 'COMPETITION_OPENED',
    newValue: { caseId, eligibleCount, ineligibleCount, minimumScore, tieBreakers },
    ruleApplied: 'YR-1.0.0:COMPETITION_6_PLUS',
    correlationId,
  });
  return { competitionId, eligibleCount, ineligibleCount };
}

export async function createCoverage(
  env: Env,
  user: AuthenticatedUser,
  correlationId: string,
  input: CreateCoverageInput,
): Promise<Record<string, unknown>> {
  const employee = await env.DB.prepare(
    'SELECT id, organization_id, group_id, base_level_id, active FROM employees WHERE id = ?',
  )
    .bind(input.absentEmployeeId)
    .first<EmployeeRow>();
  if (!employee || employee.active !== 1 || employee.organization_id !== user.organizationId) {
    throw new DomainError('ABSENT_EMPLOYEE_NOT_FOUND', 'No existe la persona ausente en la organización');
  }
  const privileged = user.roles.some((role) => ['ADMIN', 'HR'].includes(role));
  if (!privileged && user.groups.length > 0 && !user.groups.includes(employee.group_id)) {
    throw new DomainError('GROUP_SCOPE_FORBIDDEN', 'No tienes autorización sobre este grupo');
  }
  const durationDays = countCalendarDays(input.startsAt, input.endsAt);
  const processType = determineCoverageProcess(durationDays);
  const transition = await env.DB.prepare(
    'SELECT source_level_id, target_level_id FROM level_transitions WHERE group_id = ? AND target_level_id = ? AND active = 1',
  )
    .bind(employee.group_id, employee.base_level_id)
    .first<TransitionRow>();
  if (!transition) {
    throw new DomainError('NO_AUTHORIZED_LEVEL_TRANSITION', 'No existe nivel inferior autorizado para cubrir la vacante');
  }

  const absenceId = crypto.randomUUID();
  const caseId = crypto.randomUUID();
  const folio = `YR-${new Date().getUTCFullYear()}-${caseId.slice(0, 8).toUpperCase()}`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO absences (
      id, employee_id, group_id, level_id, reason, starts_at, ends_at, status, source, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?)`)
      .bind(absenceId, employee.id, employee.group_id, employee.base_level_id, input.reason, input.startsAt, input.endsAt, input.source, user.id),
    env.DB.prepare(`INSERT INTO coverage_cases (
      id, folio, absence_id, group_id, vacant_level_id, starts_at, ends_at,
      duration_days, process_type, status, rule_version, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_VALIDATION', 'YR-1.0.0', ?)`)
      .bind(caseId, folio, absenceId, employee.group_id, employee.base_level_id, input.startsAt, input.endsAt, durationDays, processType, user.id),
  ]);

  if (processType === 'ROTATION') {
    const rotation = await createRotationAssignment(
      env,
      user,
      correlationId,
      caseId,
      employee.group_id,
      transition.source_level_id,
      transition.target_level_id,
      input.startsAt,
      input.endsAt,
    );
    return { caseId, folio, processType, durationDays, rotation };
  }

  if (!input.competition) {
    await env.DB.prepare(
      "UPDATE coverage_cases SET status = 'PENDING_INFORMATION', version = version + 1 WHERE id = ?",
    ).bind(caseId).run();
    return {
      caseId,
      folio,
      processType,
      durationDays,
      missing: ['competition.registrationStartsAt', 'competition.registrationEndsAt', 'competition.examAt'],
    };
  }
  const competition = await createCompetition(
    env,
    user,
    correlationId,
    caseId,
    transition.source_level_id,
    transition.target_level_id,
    input.startsAt,
    input.endsAt,
    input.competition,
  );
  return { caseId, folio, processType, durationDays, competition };
}
