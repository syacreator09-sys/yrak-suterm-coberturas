import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import type { Env } from '../types.js';

export interface CoverageWorkflowParams {
  coverageCaseId: string;
  processType: 'ROTATION' | 'COMPETITION';
  startsAt: string;
  endsAt: string;
}

interface CoverageRow {
  id: string;
  group_id: string;
  status: string;
  process_type: 'ROTATION' | 'COMPETITION';
  starts_at: string;
  ends_at: string;
  organization_id: string;
}

export class CoverageWorkflow extends WorkflowEntrypoint<Env, CoverageWorkflowParams> {
  public async run(event: WorkflowEvent<CoverageWorkflowParams>, step: WorkflowStep) {
    const coverage = await step.do('validate-coverage-case', async () => {
      const row = await this.env.DB.prepare(`SELECT cc.id, cc.group_id, cc.status,
          cc.process_type, cc.starts_at, cc.ends_at, g.organization_id
        FROM coverage_cases cc JOIN groups g ON g.id = cc.group_id WHERE cc.id = ?`)
        .bind(event.payload.coverageCaseId)
        .first<CoverageRow>();
      if (!row) throw new Error('Coverage case not found');
      if (row.process_type !== event.payload.processType) {
        throw new Error('Coverage process type mismatch');
      }
      return row;
    });

    const approval = await step.waitForEvent<{ approvedBy: string; approvedAt: string }>(
      'wait-for-assignment-approval',
      { type: 'assignment-approved', timeout: '30 days' },
    );

    await step.do('record-workflow-approval-event', async () => {
      await this.env.DB.prepare(`INSERT INTO audit_events (
        id, organization_id, actor_id, actor_type, entity_type, entity_id,
        action, rule_applied, reason, correlation_id, occurred_at
      ) VALUES (?, ?, ?, 'SYSTEM', 'COVERAGE_CASE', ?,
        'WORKFLOW_APPROVAL_RECEIVED', 'YR-1.0.0', 'Aprobación entregada al workflow', ?, ?)`)
        .bind(
          crypto.randomUUID(),
          coverage.organization_id,
          approval.payload.approvedBy,
          coverage.id,
          event.instanceId,
          approval.payload.approvedAt,
        )
        .run();
      return { approved: true };
    });

    const startTimestamp = new Date(event.payload.startsAt).getTime();
    if (startTimestamp > Date.now()) {
      await step.sleepUntil('wait-for-coverage-start', startTimestamp);
    }

    await step.do(
      'activate-coverage',
      { retries: { limit: 3, delay: '5 seconds', backoff: 'linear' } },
      async () => {
        await this.env.DB.batch([
          this.env.DB.prepare(
            "UPDATE coverage_cases SET status = 'ACTIVE', version = version + 1, updated_at = datetime('now') WHERE id = ? AND status IN ('ROTATION_ASSIGNED','AWARDED','SCHEDULED')",
          ).bind(coverage.id),
          this.env.DB.prepare(
            "UPDATE temporary_assignments SET status = 'ACTIVE', version = version + 1, updated_at = datetime('now') WHERE coverage_case_id = ? AND status IN ('APPROVED','SCHEDULED')",
          ).bind(coverage.id),
          this.env.DB.prepare(`INSERT INTO outbox_events (
            id, topic, aggregate_type, aggregate_id, payload_json
          ) VALUES (?, 'COVERAGE_STARTED', 'COVERAGE_CASE', ?, ?)`)
            .bind(
              crypto.randomUUID(),
              coverage.id,
              JSON.stringify({ coverageCaseId: coverage.id }),
            ),
        ]);
        return { activeAt: new Date().toISOString() };
      },
    );

    const endTimestamp = new Date(event.payload.endsAt).getTime() + 1;
    if (endTimestamp > Date.now()) {
      await step.sleepUntil('wait-for-coverage-end', endTimestamp);
    }

    return step.do(
      'complete-and-return',
      { retries: { limit: 5, delay: '10 seconds', backoff: 'exponential' } },
      async () => {
        const returnedAt = new Date().toISOString();
        const assignment = await this.env.DB.prepare(`SELECT id, employee_id, base_level_id,
            target_level_id
          FROM temporary_assignments
          WHERE coverage_case_id = ? AND status = 'ACTIVE'
          ORDER BY chain_order LIMIT 1`)
          .bind(coverage.id)
          .first<{
            id: string;
            employee_id: string;
            base_level_id: string;
            target_level_id: string;
          }>();
        if (!assignment) throw new Error('Active assignment not found');

        const statements: D1PreparedStatement[] = [
          this.env.DB.prepare(
            "UPDATE temporary_assignments SET status = 'COMPLETED', returned_at = ?, version = version + 1, updated_at = datetime('now') WHERE coverage_case_id = ? AND status = 'ACTIVE'",
          ).bind(returnedAt, coverage.id),
          this.env.DB.prepare(
            "UPDATE coverage_cases SET status = 'COMPLETED', version = version + 1, updated_at = datetime('now') WHERE id = ? AND status = 'ACTIVE'",
          ).bind(coverage.id),
          this.env.DB.prepare(`INSERT INTO audit_events (
            id, organization_id, actor_id, actor_type, entity_type, entity_id,
            action, rule_applied, reason, correlation_id, occurred_at
          ) VALUES (?, ?, 'coverage-workflow', 'SYSTEM', 'COVERAGE_CASE', ?,
            'COMPLETED_AND_RETURNED', 'YR-1.0.0', 'Fin programado de cobertura', ?, ?)`)
            .bind(
              crypto.randomUUID(),
              coverage.organization_id,
              coverage.id,
              event.instanceId,
              returnedAt,
            ),
          this.env.DB.prepare(`INSERT INTO outbox_events (
            id, topic, aggregate_type, aggregate_id, payload_json
          ) VALUES (?, 'COVERAGE_COMPLETED', 'COVERAGE_CASE', ?, ?)`)
            .bind(
              crypto.randomUUID(),
              coverage.id,
              JSON.stringify({ coverageCaseId: coverage.id, returnedAt }),
            ),
        ];

        if (coverage.process_type === 'ROTATION') {
          const pool = await this.env.DB.prepare(`SELECT id FROM rotation_pools
            WHERE group_id = ? AND source_level_id = ? AND target_level_id = ? AND active = 1`)
            .bind(coverage.group_id, assignment.base_level_id, assignment.target_level_id)
            .first<{ id: string }>();
          if (!pool) throw new Error('Rotation pool not found');
          const selectedEntry = await this.env.DB.prepare(`SELECT queue_position FROM rotation_queue_entries
            WHERE pool_id = ? AND employee_id = ?`)
            .bind(pool.id, assignment.employee_id)
            .first<{ queue_position: number }>();
          const maximum = await this.env.DB.prepare(
            'SELECT MAX(queue_position) AS maximum FROM rotation_queue_entries WHERE pool_id = ?',
          )
            .bind(pool.id)
            .first<{ maximum: number }>();
          if (!selectedEntry || maximum?.maximum === undefined) {
            throw new Error('Rotation queue entry not found');
          }
          const parkingPosition = maximum.maximum + 1;
          statements.push(
            this.env.DB.prepare(`UPDATE rotation_queue_entries
              SET queue_position = ?, updated_at = datetime('now')
              WHERE pool_id = ? AND employee_id = ?`)
              .bind(parkingPosition, pool.id, assignment.employee_id),
            this.env.DB.prepare(`UPDATE rotation_queue_entries
              SET queue_position = queue_position - 1, updated_at = datetime('now')
              WHERE pool_id = ? AND employee_id <> ? AND queue_position > ?`)
              .bind(pool.id, assignment.employee_id, selectedEntry.queue_position),
            this.env.DB.prepare(`UPDATE rotation_queue_entries
              SET queue_position = ?, availability = 'AVAILABLE', times_selected = times_selected + 1,
                  last_coverage_at = ?, version = version + 1, updated_at = datetime('now')
              WHERE pool_id = ? AND employee_id = ?`)
              .bind(maximum.maximum, returnedAt, pool.id, assignment.employee_id),
            this.env.DB.prepare(`INSERT INTO rotation_events (
              id, pool_id, employee_id, coverage_case_id, event_type,
              previous_position, new_position, reason
            ) VALUES (?, ?, ?, ?, 'MOVED_TO_END', ?, ?, 'Cobertura completada')`)
              .bind(
                crypto.randomUUID(),
                pool.id,
                assignment.employee_id,
                coverage.id,
                selectedEntry.queue_position,
                maximum.maximum,
              ),
          );
        }

        await this.env.DB.batch(statements);
        const coordinator = this.env.GROUP_COORDINATOR.getByName(coverage.group_id);
        await coordinator.release(coverage.id);
        return { coverageCaseId: coverage.id, status: 'COMPLETED', returnedAt };
      },
    );
  }
}
