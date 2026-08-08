import { describe, expect, it } from 'vitest';
import { bootstrapEnabled } from './bootstrap.js';

describe('bootstrapEnabled', () => {
  it('is fail-closed unless explicitly true', () => {
    expect(bootstrapEnabled(undefined)).toBe(false);
    expect(bootstrapEnabled('')).toBe(false);
    expect(bootstrapEnabled('false')).toBe(false);
    expect(bootstrapEnabled('1')).toBe(false);
    expect(bootstrapEnabled('true')).toBe(true);
    expect(bootstrapEnabled(' TRUE ')).toBe(true);
  });
});
