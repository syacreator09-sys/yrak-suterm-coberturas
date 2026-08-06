import { DomainError } from '@yrak/domain';
import { appendAudit } from '../audit.js';
import { enqueueOutbox } from '../outbox.js';
import type { AuthenticatedUser, Env } from '../types.js';

export async function decideApproval(
  env: Env,
  user: AuthenticatedUser,
  correlationId: string,
  approvalId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason: string,
): Promise<{ coverageCaseId: string; workflowInstanceId?: string }> {
  const approval = await env.DB.prepare(`SELECT a.id, a.entity_id, a.action, a.status,
      cc.process_type, cc.group_id, cc.starts_at, cc.ends_at
    FROM approvals a JOIN coverage_cases cc ON cc.id = a.entity_id
    JOIN groups g ON g.id = cc.group_id
    WHERE a.id = ? AND a.entity_type = 'COVERAGE_CASE' AND g.organization_id = ?`)
    .bind(approvalId, user.organizationId)
    .first<{
      id: string;
      entity_id: string;
      action: string;
      status: string;
      process_type: 'ROTATION' | 'COMPETITION';
      group_id: string;
      starts_at: string;
      ends_at: string;
    }>();
  if (!approval || approval.status !== 'PENDING') {
    throw new DomainError('PENDING_APPROVAL_NOT_FOUND', 'No existe una aprobación pendiente');
  }
  const assignment = await env.DB.prepare(
    "SELECT id, employee_id FROM temporary_assignments WHERE coverage_case_id = ? AND status = 'PROPOSED' ORDER BY chain_order LIMIT 1",
  )
    .bind(approval.entity_id)
    .first<{ id: string; employee_id: string }>();
  if (!assignment) throw new DomainError('PROPOSED_ASSIGNMENT_NOT_FOUND', 'No existe asignación propuesta');

  if (decision === 'REJECTED') {
    const statements: D1PreparedStatement[] = [
      env.DB.prepare("UPDATE approvals SET status = 'REJECTED', decided_by = ?, decided_at = datetime('now'), reason = ? WHERE id = ? AND status = 'PENDING'").bind(user.id, reason, approvalId),
      env.DB.prepare("UPDATE temporary_assignments SET status = 'CANCELLED', version = version + 1, updated_at = datetime('now') WHERE id = ?").bind(assignment.id),
      env.DB.prepare("UPDATE coverage_cases SET status = 'CANCELLED', version = version + 1, updated_at = datetime('now') WHERE id = ?").bind(approval.entity_id),
    ];
    if (approval.process_type === 'ROTATION') {
      statements.push(
        env.DB.prepare("UPDATE rotation_queue_entries SET availability = 'AVAILABLE', version = version + 1 WHERE employee_id = ? AND availability = 'RESERVED'").bind(assignment.employee_id),
      );
    }
    await env.DB.batch(statements);
    const coordinator = env.GROUP_COORDINATOR.getByName(approval.group_id);
    await coordinator.release(approval.entity_id);
    await appendAudit(env, {
      organizationId: user.organizationId,
      actor: user,
      entityType: 'COVERAGE_CASE',
      entityId: approval.entity_id,
      action: 'ASSIGNMENT_REJECTED',
      reason,
      correlationId,
    });
    await enqueueOutbox(env, 'ASSIGNMENT_REJECTED', 'COVERAGE_CASE', approval.entity_id);
    return { coverageCaseId: approval.entity_id };
  }

  const nextCoverageStatus = approval.process_type === 'ROTATION' ? 'ROTATION_ASSIGNED' : 'AWARDED';
  const statements: D1PreparedStatement[] = [
    env.DB.prepare("UPDATE approvals SET status = 'APPROVED', decided_by = ?, decided_at = datetime('now'), reason = ? WHERE id = ? AND status = 'PENDING'").bind(user.id, reason, approvalId),
    env.DB.prepare("UPDATE temporary_assignments SET status = 'APPROVED', approved_by = ?, version = version + 1, updated_at = datetime('now') WHERE id = ?").bind(user.id, assignment.id),
    env.DB.prepare("UPDATE coverage_cases SET status = ?, version = version + 1, updated_at = datetime('now') WHERE id = ?").bind(nextCoverageStatus, approval.entity_id),
  ];
  if (approval.process_type === 'ROTATION') {
    statements.push(
      env.DB.prepare("UPDATE rotation_queue_entries SET availability = 'ASSIGNED', version = version + 1 WHERE employee_id = ? AND availability = 'RESERVED'").bind(assignment.employee_id),
    );
  }
  await env.DB.batch(statements);

  let workflowInstanceId = `coverage-${approval.entity_id}`;
  try {
    const instance = await env.COVERAGE_WORKFLOW.create({
      id: workflowInstanceId,
      params: {
        coverageCaseId: approval.entity_id,
        processType: approval.process_type,
        startsAt: approval.starts_at,
        endsAt: approval.ends_at,
      },
    });
    workflowInstanceId = instance.id;
  } catch {
    // Un reintento puede encontrar la instancia determinista ya creada.
  }
  const instance = await env.COVERAGE_WORKFLOW.get(workflowInstanceId);
  await instance.sendEvent({
    type: 'assignment-approved',
    payload: { approvedBy: user.id, approvedAt: new Date().toISOString() },
  });

  await appendAudit(env, {
    organizationId: user.organizationId,
    actor: user,
    entityType: 'COVERAGE_CASE',
    entityId: approval.entity_id,
    action: 'ASSIGNMENT_APPROVED',
    newValue: { assignmentId: assignment.id, workflowInstanceId },
    reason,
    correlationId,
  });
  await enqueueOutbox(env, 'ASSIGNMENT_APPROVED', 'COVERAGE_CASE', approval.entity_id);
  return { coverageCaseId: approval.entity_id, workflowInstanceId };
}
