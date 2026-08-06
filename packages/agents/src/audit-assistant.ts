export interface ReadOnlyAuditEvent {
  action: string;
  actorType: string;
  actorId: string | null;
  occurredAt: string;
  ruleApplied: string | null;
  reason: string | null;
  previousValue: unknown;
  newValue: unknown;
}

export class AuditAssistant {
  public explain(events: readonly ReadOnlyAuditEvent[]): string {
    if (events.length === 0) return 'No existen eventos de auditoría para el expediente.';
    return [...events]
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
      .map((event) => {
        const details = [
          `${event.occurredAt}: ${event.action}`,
          `actor=${event.actorType}:${event.actorId ?? 'sin-id'}`,
          event.ruleApplied ? `regla=${event.ruleApplied}` : null,
          event.reason ? `motivo=${event.reason}` : null,
        ].filter(Boolean);
        return details.join(' | ');
      })
      .join('\n');
  }
}
