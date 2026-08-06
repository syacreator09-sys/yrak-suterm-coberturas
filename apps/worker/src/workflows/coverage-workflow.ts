import { WorkflowEntrypoint } from 'cloudflare:workers';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { completeCoverage } from '../services/completion-service.js';
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
  public async run(
    event: WorkflowEvent<CoverageWorkflowParams>,
    step: WorkflowStep,
  ): Promise<Record<string, unknown>> {
    const coverage = await step.do('validate-coverage-case', async () => {
      const row = await this.env.DB.prepare(
        `SELECT cc.id, cc.group_id, cc.status,
          cc.process_type, cc.starts_at, cc.ends_at, g.organization_id
        FROM coverage_cases cc JOIN groups g ON g.id = cc.group_id WHERE cc.id = ?`,
      )
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
      await this.env.DB.prepare(
        `INSERT INTO audit_events (
        id, organization_id, actor_id, actor_type, entity_type, entity_id,
        action, rule_applied, reason, correlation_id, occurred_at
      ) VALUES (?, ?, ?, 'SYSTEM', 'COVERAGE_CASE', ?,
        'WORKFLOW_APPROVAL_RECEIVED', 'YR-1.0.0',
        'Aprobación entregada al workflow', ?, ?)`,
      )
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

    const startDate = new Date(event.payload.startsAt);
    if (startDate.getTime() > Date.now()) {
      await step.sleepUntil('wait-for-coverage-start', startDate);
    }

    const activation = await step.do(
      'activate-coverage',
      { retries: { limit: 3, delay: '5 seconds', backoff: 'linear' } },
      async () => {
        const current = await this.env.DB.prepare('SELECT status FROM coverage_cases WHERE id = ?')
          .bind(coverage.id)
          .first<{ status: string }>();
        if (!current || ['CANCELLED', 'COMPLETED'].includes(current.status)) {
          return { skipped: true, status: current?.status ?? 'MISSING' };
        }
        const actualStartedAt = new Date().toISOString();
        await this.env.DB.batch([
          this.env.DB.prepare(
            `UPDATE coverage_cases
            SET status = 'ACTIVE', actual_started_at = ?, version = version + 1,
                updated_at = datetime('now')
            WHERE id = ? AND status IN ('ROTATION_ASSIGNED','AWARDED','SCHEDULED')`,
          ).bind(actualStartedAt, coverage.id),
          this.env.DB.prepare(
            `UPDATE temporary_assignments
            SET status = 'ACTIVE', actual_started_at = ?, version = version + 1,
                updated_at = datetime('now')
            WHERE coverage_case_id = ? AND status IN ('APPROVED','SCHEDULED')`,
          ).bind(actualStartedAt, coverage.id),
          this.env.DB.prepare(
            `INSERT INTO outbox_events (
            id, topic, aggregate_type, aggregate_id, payload_json
          ) VALUES (?, 'COVERAGE_STARTED', 'COVERAGE_CASE', ?, ?)`,
          ).bind(
            crypto.randomUUID(),
            coverage.id,
            JSON.stringify({ coverageCaseId: coverage.id, actualStartedAt }),
          ),
        ]);
        return { skipped: false, actualStartedAt };
      },
    );

    if (activation.skipped) {
      return { coverageCaseId: coverage.id, status: activation.status, skipped: true };
    }

    const endDate = new Date(event.payload.endsAt);
    if (endDate.getTime() > Date.now()) {
      await step.sleepUntil('wait-for-coverage-end', endDate);
    }

    return step.do(
      'complete-and-return',
      { retries: { limit: 5, delay: '10 seconds', backoff: 'exponential' } },
      async () => {
        const result = await completeCoverage(this.env, {
          coverageCaseId: coverage.id,
          returnedAt: new Date().toISOString(),
          reason: 'Fin programado de cobertura',
          correlationId: event.instanceId,
          actor: { id: 'coverage-workflow', type: 'SYSTEM' },
          organizationId: coverage.organization_id,
        });
        return result;
      },
    );
  }
}
