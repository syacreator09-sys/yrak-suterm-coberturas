import type { AppEnv, AuthUser } from '../env.js';
import { markRotationAssigned, notifyApprovedRotation } from './rotation-service.js';
import { maybeCreateCascadeChild } from './cascade-service.js';

export async function approveCoverageAssignment(env: AppEnv, user: AuthUser, row: any, correlationId: string) {
  if (row.status === 'SCHEDULED') return { approved: true, idempotent: true, status: 'SCHEDULED' as const };
  const assignment = await env.DB.prepare(
    `SELECT id, employee_id, base_level_id FROM temporary_assignments WHERE coverage_case_id=? AND status='PROPOSED' ORDER BY chain_order LIMIT 1`,
  ).bind(row.id).first<{ id: string; employee_id: string; base_level_id: string }>();
  if (!assignment) throw new Error('PROPOSED_ASSIGNMENT_NOT_FOUND');
  if (user.role === 'EMPLOYEE' && user.employeeId !== assignment.employee_id) throw new Error('FORBIDDEN');
  await env.DB.batch([
    env.DB.prepare(`UPDATE temporary_assignments SET status='SCHEDULED', version=version+1 WHERE id=?`).bind(assignment.id),
    env.DB.prepare(`UPDATE coverage_cases SET status='SCHEDULED', version=version+1, updated_at=datetime('now') WHERE id=?`).bind(row.id),
  ]);
  if (row.process_type === 'ROTATION') {
    await markRotationAssigned(env, row, assignment.employee_id);
    await notifyApprovedRotation(env, row, assignment.employee_id);
  }
  const cascade = await maybeCreateCascadeChild(env, user, row, assignment.base_level_id, correlationId);
  if (env.COVERAGE_WORKFLOW) {
    await env.COVERAGE_WORKFLOW.create({ id: `coverage-${row.id}`, params: { coverageCaseId: row.id, startsOn: row.starts_on, endsOn: row.ends_on } });
  }
  return { approved: true, assignmentId: assignment.id, status: 'SCHEDULED' as const, cascade };
}
