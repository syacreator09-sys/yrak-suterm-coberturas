import type { AuditEventId } from '@yrak/domain';

export interface AuditActor {
  id: string;
  type: 'USER' | 'SYSTEM' | 'AGENT';
}

export interface AuditEvent {
  id: AuditEventId;
  actor: AuditActor;
  entityType: string;
  entityId: string;
  action: string;
  occurredAt: string;
  reason: string | null;
  ruleApplied: string | null;
  previousValue: Readonly<Record<string, unknown>> | null;
  newValue: Readonly<Record<string, unknown>> | null;
  correlationId: string;
}

export interface AuditEventInput extends Omit<AuditEvent, 'occurredAt'> {
  occurredAt?: string;
}

export function createAuditEvent(input: AuditEventInput): Readonly<AuditEvent> {
  return Object.freeze({
    ...input,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    previousValue: input.previousValue ? Object.freeze({ ...input.previousValue }) : null,
    newValue: input.newValue ? Object.freeze({ ...input.newValue }) : null,
  });
}

export class InMemoryAuditLog {
  readonly #events: AuditEvent[] = [];

  public append(event: AuditEvent): void {
    this.#events.push(event);
  }

  public list(): readonly AuditEvent[] {
    return this.#events.map((event) => Object.freeze({ ...event }));
  }
}
