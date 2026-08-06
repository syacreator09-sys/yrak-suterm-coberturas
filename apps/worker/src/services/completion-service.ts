import { DomainError } from '@yrak/domain';
import { appendAudit } from '../audit.js';
import { enqueueOutbox } from '../outbox.js';
import type { Env } from '../types.js';

interface CoverageCompletionActor {
  id: string;
  type: 'USER' | 'SYSTEM';
}

interface CoverageForCompletion {
  id: string;
  group_id: string;
  process_type: 'ROTATION' | 'COMPETITION';
  status: string;
  organization_id: string;
}

interface ActiveAssignment {
  id: string;
  employee_id: string;
  base_level_id: string;
  target_level_id: string;
}

export interface CompleteCoverageInput {
  coverageCaseId: string;
  returnedAt: string;
  reason: string;
  correlationId: string;
  actor: CoverageCompletionActor;
  organizationId?: string;
}

async function acquireCompletionClaim(
  env: Env,
  organizationId: string,
  coverageCaseId: string,
): Promise<string> {
  const claimId = crypto.randomUUID();
  try {
    await env.DB.prepare(`INSERT INTO idempotency_keys (
      id, organization_id, operation, idempotency_key, request_hash, expires_at
    ) VALUES (?, ?, 'COMPLETE_COVERAGE_INTERNAL', ?, ?, datetime('now', '+7 days'))`)
      .bind(claimId, organizationId, coverageCaseId, coverageCaseId)
      .run();
    return claimId;
  } catch {
    throw new DomainError(
      'COVERAGE_COMPLETION_IN_PROGRESS',
      'La terminación de esta cobertura ya está en proceso',
    );
  }
}

export async function completeCoverage(
  env: Env,
  input: CompleteCoverageInput,
): Promise<{ coverageCaseId: string; status: 'COMPLETED'; returnedAt: string; replay: boolean }> {
  const coverage = await env.DB.prepare(`SELECT cc.id, cc.group_id, cc.process_type,
      cc.status, g.organization_id
    FROM coverage_cases cc JOIN groups g ON g.id = cc.group_id
    WHERE cc.id = ?`)
    .bind(input.coverageCaseId)
    .first<CoverageForCompletion>();
  if (!coverage) throw new DomainError('COVERAGE_NOT_FOUND', 'No existe el expediente');
  if (input.organizationId && coverage.organization_id !== input.organizationId) {
    throw new DomainError('COVERAGE_NOT_FOUND', 'No existe el expediente');
  }
  if (coverage.status === 'COMPLETED') {
    const existing = await env.DB.prepare(
      'SELECT actual_ended_at FROM coverage_cases WHERE id = ?',
    )
      .bind(coverage.id)
      .first<{ actual_ended_at: string | null }>();
    return {
      coverageCaseId: coverage.id,
      status: 'COMPLETED',
      returnedAt: existing?.actual_ended_at ?? input.returnedAt,
      replay: true,
    };
  }
  if (coverage.status !== 'ACTIVE') {
    throw new DomainError(
      'COVERAGE_NOT_ACTIVE',
      'Solo una cobertura activa puede terminar anticipadamente',
      { status: coverage.status },
    );
  }

  const claimId = await acquireCompletionClaim(env, coverage.organization_id, coverage.id);
  try {
    const assignmentsResult = await env.DB.prepare(`SELECT id, employee_id,
        base_level_id, target_level_id
      FROM temporary_assignments
      WHERE coverage_case_id = ? AND status = 'ACTIVE'
      ORDER BY chain_order`)
      .bind(coverage.id)
      .all<ActiveAssignment>();
    const assignments = assignmentsResult.results ?? [];
    if (assignments.length === 0) {
      throw new DomainError('ACTIVE_ASSIGNMENT_NOT_FOUND', 'No existe asignación activa');
    }

    const statements: D1PreparedStatement[] = [
      env.DB.prepare(`UPDATE temporary_assignments
        SET status = 'COMPLETED', returned_at = ?, actual_ended_at = ?,
            version = version + 1, updated_at = datetime('now')
        WHERE coverage_case_id = ? AND status = 'ACTIVE'`)
        .bind(input.returnedAt, input.returnedAt, coverage.id),
      env.DB.prepare(`UPDATE coverage_cases
        SET status = 'COMPLETED', actual_ended_at = ?, version = version + 1,
            updated_at = datetime('now')
        WHERE id = ? AND status = 'ACTIVE'`)
        .bind(input.returnedAt, coverage.id),
      env.DB.prepare(`UPDATE competitions
        SET status = 'FINAL', version = version + 1, updated_at = datetime('now')
        WHERE coverage_case_id = ? AND status NOT IN ('FINAL','CANCELLED')`)
        .bind(coverage.id),
    ];

    if (coverage.process_type === 'ROTATION') {
      for (const assignment of assignments) {
        const pool = await env.DB.prepare(`SELECT id FROM rotation_pools
          WHERE group_id = ? AND source_level_id = ? AND target_level_id = ? AND active = 1`)
          .bind(coverage.group_id, assignment.base_level_id, assignment.target_level_id)
          .first<{ id: string }>();
        if (!pool) {
          throw new DomainError('ROTATION_POOL_NOT_FOUND', 'No existe la fila de rotación');
        }
        const entry = await env.DB.prepare(`SELECT queue_position
          FROM rotation_queue_entries WHERE pool_id = ? AND employee_id = ?`)
          .bind(pool.id, assignment.employee_id)
          .first<{ queue_position: number }>();
        const maximum = await env.DB.prepare(`SELECT MAX(queue_position) AS maximum
          FROM rotation_queue_entries WHERE pool_id = ?`)
          .bind(pool.id)
          .first<{ maximum: number | null }>();
        if (!entry || maximum?.maximum === null || maximum?.maximum === undefined) {
          throw new DomainError('ROTATION_ENTRY_NOT_FOUND', 'No existe la posición de rotación');
        }
        const parkingPosition = maximum.maximum + 1;
        statements.push(
          env.DB.prepare(`UPDATE rotation_queue_entries
            SET queue_position = ?, updated_at = datetime('now')
            WHERE pool_id = ? AND employee_id = ?`)
            .bind(parkingPosition, pool.id, assignment.employee_id),
          env.DB.prepare(`UPDATE rotation_queue_entries
            SET queue_position = queue_position - 1, updated_at = datetime('now')
            WHERE pool_id = ? AND employee_id <> ? AND queue_position > ?`)
            .bind(pool.id, assignment.employee_id, entry.queue_position),
          env.DB.prepare(`UPDATE rotation_queue_entries
            SET queue_position = ?, availability = 'AVAILABLE',
                times_selected = times_selected + 1, last_coverage_at = ?,
                version = version + 1, updated_at = datetime('now')
            WHERE pool_id = ? AND employee_id = ?`)
            .bind(maximum.maximum, input.returnedAt, pool.id, assignment.employee_id),
          env.DB.prepare(`INSERT INTO rotation_events (
            id, pool_id, employee_id, coverage_case_id, event_type,
            previous_position, new_position, reason
          ) VALUES (?, ?, ?, ?, 'MOVED_TO_END', ?, ?, ?)`)
            .bind(
              crypto.randomUUID(),
              pool.id,
              assignment.employee_id,
              coverage.id,
              entry.queue_position,
              maximum.maximum,
              input.reason,
            ),
        );
      }
    }

    await env.DB.batch(statements);
    await env.GROUP_COORDINATOR.getByName(coverage.group_id).release(coverage.id);
    await appendAudit(env, {
      organizationId: coverage.organization_id,
      actor: { id: input.actor.id },
      actorType: input.actor.type,
      entityType: 'COVERAGE_CASE',
      entityId: coverage.id,
      action: 'COMPLETED_AND_RETURNED',
      ruleApplied: 'YR-1.0.0:RETURN_TO_BASE',
      reason: input.reason,
      newValue: { returnedAt: input.returnedAt },
      correlationId: input.correlationId,
    });
    await enqueueOutbox(env, 'COVERAGE_COMPLETED', 'COVERAGE_CASE', coverage.id, {
      returnedAt: input.returnedAt,
      reason: input.reason,
    });
    await env.DB.prepare(`UPDATE idempotency_keys
      SET response_json = ?, status_code = 200 WHERE id = ?`)
      .bind(
        JSON.stringify({ coverageCaseId: coverage.id, status: 'COMPLETED' }),
        claimId,
      )
      .run();
    return {
      coverageCaseId: coverage.id,
      status: 'COMPLETED',
      returnedAt: input.returnedAt,
      replay: false,
    };
  } catch (error) {
    await env.DB.prepare('DELETE FROM idempotency_keys WHERE id = ?').bind(claimId).run();
    throw error;
  }
}
