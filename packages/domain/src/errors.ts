export class DomainError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class InvalidTransitionError extends DomainError {
  public constructor(entity: string, from: string, to: string) {
    super('INVALID_STATE_TRANSITION', `Transición inválida de ${entity}: ${from} → ${to}`, {
      entity,
      from,
      to,
    });
  }
}
