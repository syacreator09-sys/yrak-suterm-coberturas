export class DomainError extends Error {
  constructor(public readonly code: string, message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
  }
}

export class InvalidCoverageDurationError extends DomainError {
  constructor(days: number) {
    super('INVALID_COVERAGE_DURATION', `La duración efectiva debe ser mayor que cero; recibida: ${days}`, { days });
  }
}

export class InvalidStateTransitionError extends DomainError {
  constructor(entity: string, from: string, to: string) {
    super('INVALID_STATE_TRANSITION', `Transición no permitida para ${entity}: ${from} -> ${to}`, { entity, from, to });
  }
}
