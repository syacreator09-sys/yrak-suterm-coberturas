import { DomainError } from '@yrak/domain';
import { appendAudit } from '../audit.js';
import { enqueueOutbox } from '../outbox.js';
import type { AuthenticatedUser, Env } from '../types.js';

export async function cancelCoverage(
  env: Env,
  user: AuthenticatedUser,
  correlationId: string,
  input: { coverageCaseId: string; reason: string; cancelAbsence: boolean },
): Promise<{ coverageCaseId: string; status: 'CANCELLED' }> {
  const coverage = await env.DB.prepare(`SELECT cc.id, cc.absence_id, cc.group_id,
      cc.process_type, cc.status
    FROM coverage_cases cc JOIN groups g ON g.id = cc.group_id
    WHERE cc.id = ? AND g.organization_id = ?`)
    .bind(input.coverageCaseId, user.organizationId)
    .first<{
      id: string;
      absence_id: string;
      group_id: string;
      process_type: 'ROTATION' | 'COMPETITION';
      status: string;
    }>();
  if (!coverage) throw new DomainError('COVERAGE_NOT_FOUND', 'No existe el expediente');
  if (['ACTIVE', 'DISPUTED'].includes(coverage.status)) {
    throw new DomainError(
      'ACTIVE_CANCELLATION_REQUIRES_FORMAL_RETURN',
      'Una cobertura iniciada requiere un proceso formal de terminación y regreso',
    );
  }
  if (coverage.status === 'COMPLETED') {
    throw new DomainError('COMPLETED_COVERAGE_IMMUTABLE', 'Una cobertura terminada no puede cancelarse');
  }
  if (coverage.status === 'CANCELLED') return { coverageCaseId: coverage.id, status: 'CANCELLED' };

  const assignments = await env.DB.prepare(`SELECT id, employee_id, base_level_id,
      target_level_id, status
    FROM temporary_assignments WHERE coverage_case_id = ?`)
    .bind(coverage.id)
    .all<{
      id: string;
      employee_id: string;
      base_level_id: string;
      target_level_id: string;
      status: string;
    }>();
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`UPDATE coverage_cases
      SET status = 'CANCELLED', version = version + 1, updated_at = datetime('now')
      WHERE id = ?`).bind(coverage.id),
    env.DB.prepare(`UPDATE temporary_assignments
      SET status = 'CANCELLED', version = version + 1, updated_at = datetime('now')
      WHERE coverage_case_id = ? AND status NOT IN ('COMPLETED','CANCELLED','REPLACED')`)
      .bind(coverage.id),
    env.DB.prepare(`UPDATE approvals SET status = 'CANCELLED', decided_by = ?,
      decided_at = datetime('now'), reason = ?
      WHERE entity_type = 'COVERAGE_CASE' AND entity_id = ? AND status = 'PENDING'`)
      .bind(user.id, input.reason, coverage.id),
    env.DB.prepare("UPDATE competitions SET status = 'CANCELLED', version = version + 1, updated_at = datetime('now') WHERE coverage_case_id = ? AND status <> 'FINAL'")
      .bind(coverage.id),
  ];
  if (input.cancelAbsence) {
    statements.push(
      env.DB.prepare("UPDATE absences SET status = 'CANCELLED' WHERE id = ?")
        .bind(coverage.absence_id),
    );
  }
  if (coverage.process_type === 'ROTATION') {
    for (const assignment of assignments.results ?? []) {
      const pool = await env.DB.prepare(`SELECT id FROM rotation_pools
        WHERE group_id = ? AND source_level_id = ? AND target_level_id = ?`)
        .bind(coverage.group_id, assignment.base_level_id, assignment.target_level_id)
        .first<{ id: string }>();
      if (!pool) continue;
      const entry = await env.DB.prepare(`SELECT queue_position FROM rotation_queue_entries
        WHERE pool_id = ? AND employee_id = ?`)
        .bind(pool.id, assignment.employee_id)
        .first<{ queue_position: number }>();
      statements.push(
        env.DB.prepare(`UPDATE rotation_queue_entries
          SET availability = 'AVAILABLE', version = version + 1, updated_at = datetime('now')
          WHERE pool_id = ? AND employee_id = ? AND availability IN ('RESERVED','ASSIGNED')`)
          .bind(pool.id, assignment.employee_id),
      );
      if (entry) {
        statements.push(
          env.DB.prepare(`INSERT INTO rotation_events (
            id, pool_id, employee_id, coverage_case_id, event_type,
            previous_position, new_position, reason, created_by
          ) VALUES (?, ?, ?, ?, 'RESTORED', ?, ?, ?, ?)`)
            .bind(
              crypto.randomUUID(),
              pool.id,
              assignment.employee_id,
              coverage.id,
              entry.queue_position,
              entry.queue_position,
              input.reason,
              user.id,
            ),
        );
      }
    }
  }
  await env.DB.batch(statements);
  const coordinator = env.GROUP_COORDINATOR.getByName(coverage.group_id);
  await coordinator.release(coverage.id);
  await appendAudit(env, {
    organizationId: user.organizationId,
    actor: user,
    entityType: 'COVERAGE_CASE',
    entityId: coverage.id,
    action: 'CANCELLED_BEFORE_START',
    reason: input.reason,
    newValue: { cancelAbsence: input.cancelAbsence },
    correlationId,
  });
  await enqueueOutbox(env, 'ASSIGNMENT_REJECTED', 'COVERAGE_CASE', coverage.id, {
    reason: input.reason,
  });
  return { coverageCaseId: coverage.id, status: 'CANCELLED' };
}
