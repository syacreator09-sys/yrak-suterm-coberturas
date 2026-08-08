import { describe, expect, it } from 'vitest';
import { toPublicError } from './public-error.js';

describe('toPublicError', () => {
  it('preserves explicit public error codes', () => {
    expect(toPublicError(new Error('GROUP_NOT_FOUND'))).toEqual({ code: 'GROUP_NOT_FOUND', status: 404, unexpected: false });
    expect(toPublicError(new Error('GROUP_FORBIDDEN'))).toEqual({ code: 'GROUP_FORBIDDEN', status: 403, unexpected: false });
    expect(toPublicError(new Error('WORKERS_AI_NOT_CONFIGURED'))).toEqual({ code: 'WORKERS_AI_NOT_CONFIGURED', status: 400, unexpected: false });
  });

  it('keeps INTERNAL_ERROR at HTTP 500', () => {
    expect(toPublicError(new Error('INTERNAL_ERROR'))).toEqual({ code: 'INTERNAL_ERROR', status: 500, unexpected: true });
  });

  it('hides arbitrary internal exception messages', () => {
    expect(toPublicError(new Error('SQLITE_ERROR: no such column secret_value'))).toEqual({
      code: 'INTERNAL_ERROR',
      status: 500,
      unexpected: true,
    });
  });
});
