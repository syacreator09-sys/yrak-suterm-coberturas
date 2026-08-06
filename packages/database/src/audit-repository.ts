import type { AuditEvent } from '@yrak/audit';
import type { OrganizationId } from '@yrak/domain';
import type { D1DatabaseLike } from './client.js';
import { assertD1Success } from './client.js';

export class D1AuditRepository {
  public constructor(private readonly db: D1DatabaseLike) {}

  public async append(organizationId: OrganizationId, event: AuditEvent): Promise<void> {
    const result = await this.db
      .prepare(`INSERT INTO audit_events (
        id, organization_id, actor_id, actor_type, entity_type, entity_id, action,
        previous_value_json, new_value_json, rule_applied, reason, correlation_id, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`) 
      .bind(
        event.id,
        organizationId,
        event.actor.id,
        event.actor.type,
        event.entityType,
        event.entityId,
        event.action,
        event.previousValue ? JSON.stringify(event.previousValue) : null,
        event.newValue ? JSON.stringify(event.newValue) : null,
        event.ruleApplied,
        event.reason,
        event.correlationId,
        event.occurredAt,
      )
      .run();
    assertD1Success(result, 'append audit event');
  }
}
