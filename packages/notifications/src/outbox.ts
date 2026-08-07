import type { NotificationTemplateKey } from './templates.js';

export class NotificationOutbox {
  constructor(private readonly db: D1Database) {}

  async enqueue(input: { organizationId: string; entityType: string; entityId: string; channel: 'EMAIL' | 'WHATSAPP' | 'IN_APP'; recipient: string; templateKey: NotificationTemplateKey; payload: Record<string, unknown> }): Promise<string> {
    const id = crypto.randomUUID();
    await this.db.prepare(`INSERT INTO notifications (id, organization_id, entity_type, entity_id, channel, recipient, template_key, payload_json, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`)
      .bind(id, input.organizationId, input.entityType, input.entityId, input.channel, input.recipient, input.templateKey, JSON.stringify(input.payload)).run();
    return id;
  }
}
