export interface PublicError {
  code: string;
  status: 400 | 403 | 404 | 500;
  unexpected: boolean;
}

const publicCode = /^[A-Z][A-Z0-9_]{1,119}$/;

export function toPublicError(error: unknown): PublicError {
  const message = error instanceof Error ? error.message : String(error);
  if (!publicCode.test(message)) return { code: 'INTERNAL_ERROR', status: 500, unexpected: true };
  if (message === 'INTERNAL_ERROR') return { code: message, status: 500, unexpected: true };
  if (message.endsWith('_NOT_FOUND')) return { code: message, status: 404, unexpected: false };
  if (message.endsWith('_FORBIDDEN')) return { code: message, status: 403, unexpected: false };
  return { code: message, status: 400, unexpected: false };
}
