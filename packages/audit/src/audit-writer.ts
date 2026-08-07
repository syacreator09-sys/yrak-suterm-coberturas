export interface AuditInput {
  organizationId: string;
  actorId: string;
  actorRole?: string;
  entityType: string;
  entityId: string;
  action: string;
  previousValue?: unknown;
  newValue?: unknown;
  ruleApplied?: string;
  reason?: string;
  correlationId: string;
}

export class AuditWriter {
  constructor(private readonly db: D1Database) {}

  async append(input: AuditInput): Promise<string> {
    const id = crypto.randomUUID();
    await this.db.prepare(`INSERT INTO audit_events (
      id, organization_id, actor_id, actor_role, entity_type, entity_id, action,
      previous_value_json, new_value_json, rule_applied, reason, correlation_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        id,
        input.organizationId,
        input.actorId,
        input.actorRole ?? null,
        input.entityType,
        input.entityId,
        input.action,
        input.previousValue === undefined ? null : JSON.stringify(input.previousValue),
        input.newValue === undefined ? null : JSON.stringify(input.newValue),
        input.ruleApplied ?? null,
        input.reason ?? null,
        input.correlationId,
      ).run();
    return id;
  }
}
