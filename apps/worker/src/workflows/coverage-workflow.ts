import { WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import type { WorkflowEvent } from 'cloudflare:workers';
import type { Env } from '../types.js';

export interface CoverageWorkflowParams {
  coverageCaseId: string;
  processType: 'ROTATION' | 'COMPETITION';
  startsAt: string;
  endsAt: string;
}

export class CoverageWorkflow extends WorkflowEntrypoint<Env, CoverageWorkflowParams> {
  public async run(event: WorkflowEvent<CoverageWorkflowParams>, step: WorkflowStep) {
    const coverage = await step.do('validate-coverage-case', async () => {
      const row = await this.env.DB.prepare(
        'SELECT id, status, process_type, starts_at, ends_at FROM coverage_cases WHERE id = ?',
      )
        .bind(event.payload.coverageCaseId)
        .first<{ id: string; status: string; process_type: string; starts_at: string; ends_at: string }>();
      if (!row) throw new Error('Coverage case not found');
      if (row.process_type !== event.payload.processType) throw new Error('Coverage process type mismatch');
      return row;
    });

    const approval = await step.waitForEvent<{ approvedBy: string; approvedAt: string }>(
      'wait-for-assignment-approval',
      { type: 'assignment-approved', timeout: '30 days' },
    );

    await step.do('record-approval', async () => {
      await this.env.DB.prepare(`INSERT INTO approvals (
        id, entity_type, entity_id, action, status, decided_by, requested_at, decided_at, reason
      ) VALUES (?, 'COVERAGE_CASE', ?, 'APPROVE_ASSIGNMENT', 'APPROVED', ?, ?, ?, 'Workflow approval')`)
        .bind(
          crypto.randomUUID(),
          coverage.id,
          approval.payload.approvedBy,
          approval.payload.approvedAt,
          approval.payload.approvedAt,
        )
        .run();
      return { approved: true };
    });

    const startTimestamp = new Date(event.payload.startsAt).getTime();
    if (startTimestamp > Date.now()) await step.sleepUntil('wait-for-coverage-start', startTimestamp);

    await step.do(
      'activate-coverage',
      { retries: { limit: 3, delay: '5 seconds', backoff: 'linear' } },
      async () => {
        await this.env.DB.batch([
          this.env.DB.prepare("UPDATE coverage_cases SET status = 'ACTIVE', version = version + 1, updated_at = datetime('now') WHERE id = ? AND status IN ('ROTATION_ASSIGNED','AWARDED','SCHEDULED')").bind(coverage.id),
          this.env.DB.prepare("UPDATE temporary_assignments SET status = 'ACTIVE', version = version + 1, updated_at = datetime('now') WHERE coverage_case_id = ? AND status IN ('APPROVED','SCHEDULED')").bind(coverage.id),
        ]);
        return { activeAt: new Date().toISOString() };
      },
    );

    const endTimestamp = new Date(event.payload.endsAt).getTime() + 1;
    if (endTimestamp > Date.now()) await step.sleepUntil('wait-for-coverage-end', endTimestamp);

    return step.do(
      'complete-and-return',
      { retries: { limit: 5, delay: '10 seconds', backoff: 'exponential' } },
      async () => {
        const returnedAt = new Date().toISOString();
        await this.env.DB.batch([
          this.env.DB.prepare("UPDATE temporary_assignments SET status = 'COMPLETED', returned_at = ?, version = version + 1, updated_at = datetime('now') WHERE coverage_case_id = ? AND status = 'ACTIVE'").bind(returnedAt, coverage.id),
          this.env.DB.prepare("UPDATE coverage_cases SET status = 'COMPLETED', version = version + 1, updated_at = datetime('now') WHERE id = ? AND status = 'ACTIVE'").bind(coverage.id),
          this.env.DB.prepare(`INSERT INTO audit_events (
            id, organization_id, actor_id, actor_type, entity_type, entity_id,
            action, rule_applied, reason, correlation_id, occurred_at
          ) SELECT ?, g.organization_id, 'coverage-workflow', 'SYSTEM', 'COVERAGE_CASE', cc.id,
            'COMPLETED_AND_RETURNED', 'YR-1.0.0', 'Fin programado de cobertura', ?, ?
            FROM coverage_cases cc JOIN groups g ON g.id = cc.group_id WHERE cc.id = ?`)
            .bind(crypto.randomUUID(), event.instanceId, returnedAt, coverage.id),
        ]);
        return { coverageCaseId: coverage.id, status: 'COMPLETED', returnedAt };
      },
    );
  }
}
