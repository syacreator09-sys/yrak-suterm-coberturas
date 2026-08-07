import { selectNextCandidate, moveCompletedCandidateToEnd, type RotationCandidate } from '@yrak/rotation';
import type { EmployeeId } from '@yrak/domain';
import type { AppEnv, AuthUser } from '../env.js';
import { AuditWriter } from '@yrak/audit';
import { getSingleSourceLevel } from './transition-service.js';

interface CaseRow { id:string; organization_id:string; group_id:string; target_level_id:string; starts_on:string; ends_on:string; process_type:string; status:string }

export async function selectRotationAssignment(env: AppEnv, user: AuthUser, caseRow: CaseRow, correlationId: string) {
  if (caseRow.process_type !== 'ROTATION') throw new Error('NOT_ROTATION_CASE');
  const sourceLevelId = await getSingleSourceLevel(env, caseRow.group_id, caseRow.target_level_id);
  const pool = await env.DB.prepare(`SELECT id FROM rotation_pools WHERE organization_id = ? AND group_id = ? AND source_level_id = ? AND target_level_id = ? AND active = 1`)
    .bind(caseRow.organization_id, caseRow.group_id, sourceLevelId, caseRow.target_level_id).first<{ id:string }>();
  if (!pool) throw new Error('ROTATION_POOL_NOT_CONFIGURED');

  const result = await env.DB.prepare(`SELECT q.employee_id, q.queue_position,
      CASE WHEN EXISTS (SELECT 1 FROM employee_unavailability u WHERE u.employee_id = q.employee_id AND u.starts_on <= ? AND u.ends_on >= ?)
        OR EXISTS (SELECT 1 FROM temporary_assignments a WHERE a.employee_id = q.employee_id AND a.status IN ('APPROVED','SCHEDULED','ACTIVE') AND a.starts_on <= ? AND a.ends_on >= ?)
        THEN 'UNAVAILABLE' ELSE q.status END AS computed_status
    FROM rotation_queue_entries q JOIN employees e ON e.id = q.employee_id
    WHERE q.pool_id = ? AND e.active = 1 ORDER BY q.queue_position`)
    .bind(caseRow.ends_on, caseRow.starts_on, caseRow.ends_on, caseRow.starts_on, pool.id)
    .all<{ employee_id:string; queue_position:number; computed_status:RotationCandidate['availability'] }>();

  const candidates: RotationCandidate[] = (result.results ?? []).map((row) => ({ employeeId: row.employee_id as EmployeeId, position: row.queue_position, availability: row.computed_status, ...(row.computed_status !== 'AVAILABLE' ? { unavailableReason: row.computed_status } : {}) }));
  const selection = selectNextCandidate(candidates);
  const coordinator = env.GROUP_COORDINATOR.getByName(caseRow.group_id);
  const reservation = await coordinator.reserve(String(selection.selected.employeeId), caseRow.id);
  if (!reservation.reserved) throw new Error('CANDIDATE_RESERVED_ELSEWHERE');

  const assignmentId = crypto.randomUUID();
  const statements = selection.considered.map((item) => env.DB.prepare(`INSERT INTO coverage_candidate_evaluations
    (id, coverage_case_id, employee_id, process_type, selected, reason_codes_json, queue_position, snapshot_json)
    VALUES (?, ?, ?, 'ROTATION', ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), caseRow.id, item.employeeId, item.selected ? 1 : 0, JSON.stringify(item.reason ? [item.reason] : []), item.position, JSON.stringify(item)));
  statements.push(env.DB.prepare(`INSERT INTO temporary_assignments
    (id, coverage_case_id, employee_id, base_level_id, target_level_id, starts_on, ends_on, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'PROPOSED')`).bind(assignmentId, caseRow.id, selection.selected.employeeId, sourceLevelId, caseRow.target_level_id, caseRow.starts_on, caseRow.ends_on));
  statements.push(env.DB.prepare(`UPDATE coverage_cases SET status = 'CANDIDATES_CALCULATED', version = version + 1, updated_at = datetime('now') WHERE id = ?`).bind(caseRow.id));
  try {
    await env.DB.batch(statements);
  } catch (error) {
    await coordinator.release(String(selection.selected.employeeId), caseRow.id);
    throw error;
  }
  await new AuditWriter(env.DB).append({ organizationId: caseRow.organization_id, actorId: user.id, actorRole: user.role, entityType: 'COVERAGE_CASE', entityId: caseRow.id, action: 'ROTATION_CANDIDATE_SELECTED', newValue: { assignmentId, employeeId: selection.selected.employeeId, considered: selection.considered }, ruleApplied: 'SHORT_COVERAGE_ROTATION', correlationId });
  return { assignmentId, employeeId: selection.selected.employeeId, sourceLevelId, targetLevelId: caseRow.target_level_id, considered: selection.considered };
}

export async function completeRotationAssignment(env: AppEnv, user: AuthUser, caseRow: CaseRow, correlationId: string) {
  const assignment = await env.DB.prepare(`SELECT id, employee_id, base_level_id, target_level_id FROM temporary_assignments
    WHERE coverage_case_id = ? AND status IN ('APPROVED','SCHEDULED','ACTIVE') ORDER BY chain_order LIMIT 1`).bind(caseRow.id).first<{ id:string; employee_id:string; base_level_id:string; target_level_id:string }>();
  if (!assignment) throw new Error('ACTIVE_ASSIGNMENT_NOT_FOUND');
  const pool = await env.DB.prepare(`SELECT id FROM rotation_pools WHERE organization_id = ? AND group_id = ? AND source_level_id = ? AND target_level_id = ?`)
    .bind(caseRow.organization_id, caseRow.group_id, assignment.base_level_id, assignment.target_level_id).first<{ id:string }>();
  if (!pool) throw new Error('ROTATION_POOL_NOT_FOUND');
  const queue = await env.DB.prepare(`SELECT employee_id, queue_position, status FROM rotation_queue_entries WHERE pool_id = ? ORDER BY queue_position`).bind(pool.id).all<{ employee_id:string; queue_position:number; status:RotationCandidate['availability'] }>();
  const before: RotationCandidate[] = (queue.results ?? []).map((row) => ({ employeeId: row.employee_id as EmployeeId, position: row.queue_position, availability: row.status }));
  const after = moveCompletedCandidateToEnd(before, assignment.employee_id as EmployeeId);
  const statements = [
    env.DB.prepare(`UPDATE rotation_queue_entries SET queue_position = queue_position + 10000 WHERE pool_id = ?`).bind(pool.id),
    ...after.map((item) => env.DB.prepare(`UPDATE rotation_queue_entries SET queue_position = ?, status = 'AVAILABLE', last_coverage_at = datetime('now'), times_selected = times_selected + CASE WHEN employee_id = ? THEN 1 ELSE 0 END, version = version + 1 WHERE pool_id = ? AND employee_id = ?`)
      .bind(item.position, assignment.employee_id, pool.id, item.employeeId)),
    env.DB.prepare(`UPDATE temporary_assignments SET status = 'COMPLETED', returned_at = datetime('now'), version = version + 1 WHERE id = ?`).bind(assignment.id),
    env.DB.prepare(`UPDATE coverage_cases SET status = 'COMPLETED', version = version + 1, updated_at = datetime('now') WHERE id = ?`).bind(caseRow.id),
    env.DB.prepare(`INSERT INTO rotation_events (id, pool_id, employee_id, coverage_case_id, event_type, previous_position, new_position, reason, actor_id) VALUES (?, ?, ?, ?, 'MOVED_TO_END', ?, ?, 'COVERAGE_COMPLETED', ?)`)
      .bind(crypto.randomUUID(), pool.id, assignment.employee_id, caseRow.id, before.find((x) => x.employeeId === assignment.employee_id)?.position ?? null, after.find((x) => x.employeeId === assignment.employee_id)?.position ?? null, user.id),
  ];
  await env.DB.batch(statements);
  await env.GROUP_COORDINATOR.getByName(caseRow.group_id).release(assignment.employee_id, caseRow.id);
  await new AuditWriter(env.DB).append({ organizationId: caseRow.organization_id, actorId: user.id, actorRole: user.role, entityType: 'COVERAGE_CASE', entityId: caseRow.id, action: 'COVERAGE_COMPLETED_AND_RETURNED', previousValue: { queue: before }, newValue: { queue: after, returnedToBaseLevelId: assignment.base_level_id }, ruleApplied: 'RETURN_TO_BASE_AND_MOVE_TO_QUEUE_END', correlationId });
  return { returnedEmployeeId: assignment.employee_id, baseLevelId: assignment.base_level_id, queue: after };
}
