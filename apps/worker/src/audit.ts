import type { AuthenticatedUser, Env } from './types.js';

export interface AppendAuditInput {
  organizationId: string;
  actor: Pick<AuthenticatedUser, 'id'> | { id: string };
  actorType?: 'USER' | 'SYSTEM' | 'AGENT';
  entityType: string;
  entityId: string;
  action: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ruleApplied?: string | null;
  reason?: string | null;
  correlationId: string;
}

export async function appendAudit(env: Env, input: AppendAuditInput): Promise<void> {
  await env.DB.prepare(`INSERT INTO audit_events (
    id, organization_id, actor_id, actor_type, entity_type, entity_id, action,
    previous_value_json, new_value_json, rule_applied, reason, correlation_id, occurred_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      crypto.randomUUID(),
      input.organizationId,
      input.actor.id,
      input.actorType ?? 'USER',
      input.entityType,
      input.entityId,
      input.action,
      input.previousValue ? JSON.stringify(input.previousValue) : null,
      input.newValue ? JSON.stringify(input.newValue) : null,
      input.ruleApplied ?? null,
      input.reason ?? null,
      input.correlationId,
      new Date().toISOString(),
    )
    .run();
}
