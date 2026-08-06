import { DomainError } from '@yrak/domain';
import { rankCandidates } from '@yrak/competition';
import { appendAudit } from '../audit.js';
import type { AuthenticatedUser, Env } from '../types.js';

export async function recordScore(
  env: Env,
  user: AuthenticatedUser,
  correlationId: string,
  input: {
    competitionId: string;
    employeeId: string;
    examScore: number;
    criticalSectionScore?: number;
    correctionReason?: string;
  },
): Promise<{ revisionId: string }> {
  const candidate = await env.DB.prepare(`SELECT cc.id, c.coverage_case_id
    FROM competition_candidates cc
    JOIN competitions c ON c.id = cc.competition_id
    JOIN coverage_cases cv ON cv.id = c.coverage_case_id
    JOIN groups g ON g.id = cv.group_id
    WHERE cc.competition_id = ? AND cc.employee_id = ? AND cc.eligibility_status = 'ELIGIBLE'
      AND g.organization_id = ?`)
    .bind(input.competitionId, input.employeeId, user.organizationId)
    .first<{ id: string; coverage_case_id: string }>();
  if (!candidate) throw new DomainError('ELIGIBLE_CANDIDATE_NOT_FOUND', 'El candidato no es elegible');
  if (input.examScore < 0 || input.examScore > 100) {
    throw new DomainError('INVALID_EXAM_SCORE', 'La calificación debe estar entre 0 y 100');
  }
  const previous = await env.DB.prepare(
    'SELECT id FROM competition_score_revisions WHERE candidate_id = ? ORDER BY created_at DESC LIMIT 1',
  )
    .bind(candidate.id)
    .first<{ id: string }>();
  if (previous && !input.correctionReason) {
    throw new DomainError('CORRECTION_REASON_REQUIRED', 'La corrección requiere motivo');
  }
  const revisionId = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO competition_score_revisions (
    id, candidate_id, exam_score, critical_section_score, entered_by,
    supersedes_revision_id, correction_reason
  ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      revisionId,
      candidate.id,
      input.examScore,
      input.criticalSectionScore ?? null,
      user.id,
      previous?.id ?? null,
      input.correctionReason ?? null,
    )
    .run();
  await appendAudit(env, {
    organizationId: user.organizationId,
    actor: user,
    entityType: 'COMPETITION_SCORE_REVISION',
    entityId: revisionId,
    action: previous ? 'SCORE_CORRECTED' : 'SCORE_RECORDED',
    newValue: { examScore: input.examScore, criticalSectionScore: input.criticalSectionScore },
    reason: input.correctionReason ?? null,
    correlationId,
  });
  return { revisionId };
}

export async function approveScoreRevision(
  env: Env,
  user: AuthenticatedUser,
  correlationId: string,
  revisionId: string,
): Promise<void> {
  const revision = await env.DB.prepare(`SELECT sr.id, sr.entered_by, cc.competition_id
    FROM competition_score_revisions sr
    JOIN competition_candidates cc ON cc.id = sr.candidate_id
    WHERE sr.id = ?`)
    .bind(revisionId)
    .first<{ id: string; entered_by: string; competition_id: string }>();
  if (!revision) throw new DomainError('SCORE_REVISION_NOT_FOUND', 'No existe la revisión');
  if (revision.entered_by === user.id) {
    throw new DomainError('SECOND_APPROVER_REQUIRED', 'Quien capturó la calificación no puede aprobarla');
  }
  await env.DB.prepare(
    'UPDATE competition_score_revisions SET approved_by = ? WHERE id = ? AND approved_by IS NULL',
  ).bind(user.id, revisionId).run();
  await appendAudit(env, {
    organizationId: user.organizationId,
    actor: user,
    entityType: 'COMPETITION_SCORE_REVISION',
    entityId: revisionId,
    action: 'SCORE_REVISION_APPROVED',
    correlationId,
  });
}

export async function finalizeCompetition(
  env: Env,
  user: AuthenticatedUser,
  correlationId: string,
  competitionId: string,
): Promise<{ winnerEmployeeId: string; approvalId: string; ranking: unknown[] }> {
  const competition = await env.DB.prepare(`SELECT c.id, c.coverage_case_id, c.target_level_id,
      c.minimum_score, c.tie_breaker_rules_json, cv.starts_at, cv.ends_at, cv.group_id
    FROM competitions c JOIN coverage_cases cv ON cv.id = c.coverage_case_id
    JOIN groups g ON g.id = cv.group_id
    WHERE c.id = ? AND g.organization_id = ?`)
    .bind(competitionId, user.organizationId)
    .first<{
      id: string;
      coverage_case_id: string;
      target_level_id: string;
      minimum_score: number;
      tie_breaker_rules_json: string;
      starts_at: string;
      ends_at: string;
      group_id: string;
    }>();
  if (!competition) throw new DomainError('COMPETITION_NOT_FOUND', 'No existe el concurso');

  const candidatesResult = await env.DB.prepare(`SELECT cc.id AS candidate_id, cc.employee_id,
      e.seniority_date, sr.exam_score, sr.critical_section_score
    FROM competition_candidates cc
    JOIN employees e ON e.id = cc.employee_id
    JOIN competition_score_revisions sr ON sr.id = (
      SELECT sr2.id FROM competition_score_revisions sr2
      WHERE sr2.candidate_id = cc.id AND sr2.approved_by IS NOT NULL
      ORDER BY sr2.created_at DESC LIMIT 1
    )
    WHERE cc.competition_id = ? AND cc.eligibility_status = 'ELIGIBLE'
      AND cc.accepted_participation = 1`)
    .bind(competitionId)
    .all<{
      candidate_id: string;
      employee_id: string;
      seniority_date: string;
      exam_score: number;
      critical_section_score: number | null;
    }>();
  const candidates = (candidatesResult.results ?? []).filter(
    (candidate) => candidate.exam_score >= competition.minimum_score,
  );
  if (candidates.length === 0) {
    throw new DomainError('NO_QUALIFIED_COMPETITION_CANDIDATE', 'Ningún candidato aprobado alcanza la calificación mínima');
  }
  const ranking = rankCandidates(
    candidates.map((candidate) => ({
      employeeId: candidate.employee_id as never,
      examScore: candidate.exam_score,
      ...(candidate.critical_section_score === null ? {} : { criticalSectionScore: candidate.critical_section_score }),
      seniorityDate: candidate.seniority_date,
    })),
    JSON.parse(competition.tie_breaker_rules_json),
  );
  const winner = ranking[0];
  if (!winner) throw new DomainError('NO_COMPETITION_WINNER', 'No fue posible determinar ganador');
  const winnerRow = candidates.find((candidate) => candidate.employee_id === winner.employeeId);
  if (!winnerRow) throw new DomainError('WINNER_CANDIDATE_MISMATCH', 'Ganador inconsistente');
  const employee = await env.DB.prepare('SELECT base_level_id FROM employees WHERE id = ?')
    .bind(winner.employeeId)
    .first<{ base_level_id: string }>();
  if (!employee) throw new DomainError('WINNER_NOT_FOUND', 'No existe el ganador');

  const assignmentId = crypto.randomUUID();
  const approvalId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`INSERT INTO temporary_assignments (
      id, coverage_case_id, employee_id, base_level_id, target_level_id, chain_order,
      starts_at, ends_at, status
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, 'PROPOSED')`)
      .bind(assignmentId, competition.coverage_case_id, winner.employeeId, employee.base_level_id, competition.target_level_id, competition.starts_at, competition.ends_at),
    env.DB.prepare(`INSERT INTO approvals (
      id, entity_type, entity_id, action, status, requested_by
    ) VALUES (?, 'COVERAGE_CASE', ?, 'APPROVE_COMPETITION_RESULT', 'PENDING', ?)`)
      .bind(approvalId, competition.coverage_case_id, user.id),
    env.DB.prepare("UPDATE competitions SET status = 'RESULT_PROVISIONAL', version = version + 1, updated_at = datetime('now') WHERE id = ?").bind(competitionId),
    env.DB.prepare("UPDATE coverage_cases SET status = 'PENDING_APPROVAL', version = version + 1, updated_at = datetime('now') WHERE id = ?").bind(competition.coverage_case_id),
  ];
  for (const candidate of candidates) {
    const rank = ranking.find((item) => item.employeeId === candidate.employee_id)?.rank;
    statements.push(
      env.DB.prepare('UPDATE competition_candidates SET result_status = ? WHERE id = ?')
        .bind(candidate.employee_id === winner.employeeId ? 'WINNER' : rank === 2 ? 'RUNNER_UP' : 'NOT_SELECTED', candidate.candidate_id),
    );
  }
  await env.DB.batch(statements);
  await appendAudit(env, {
    organizationId: user.organizationId,
    actor: user,
    entityType: 'COMPETITION',
    entityId: competitionId,
    action: 'RESULT_PROVISIONAL_CREATED',
    newValue: { winnerEmployeeId: winner.employeeId, ranking },
    ruleApplied: `tie-breakers:${competition.tie_breaker_rules_json}`,
    correlationId,
  });
  return { winnerEmployeeId: winner.employeeId, approvalId, ranking };
}
