import { describe, expect, it } from 'vitest';
import {
  countCalendarDays,
  determineCoverageProcess,
  defaultCoveragePolicy,
} from '../../../packages/domain/src/index.js';

describe('coverage policy', () => {
  it.each([
    [1, 'ROTATION'],
    [5, 'ROTATION'],
    [6, 'COMPETITION'],
    [14, 'COMPETITION'],
  ] as const)('classifies %s days as %s', (days, expected) => {
    expect(determineCoverageProcess(days, defaultCoveragePolicy)).toBe(expected);
  });

  it.each([0, -1, 1.5])('rejects invalid duration %s', (days) => {
    expect(() => determineCoverageProcess(days)).toThrowError(/duración/i);
  });

  it('counts calendar days inclusively', () => {
    expect(countCalendarDays('2026-08-01T00:00:00.000Z', '2026-08-05T00:00:00.000Z')).toBe(5);
  });
});
