import { describe, expect, it } from 'vitest';
import { clip } from './session.js';

describe('clip', () => {
  it('recorta y marca truncado', () => {
    expect(clip('abc', 5)).toBe('abc');
    expect(clip('abcdefgh', 5)).toBe('abcde…[truncado]');
  });
});
