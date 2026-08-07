import { describe, expect, it } from 'vitest';
import { DEFAULT_COVERAGE_POLICY } from '@yrak/domain';
import { previewCoverage } from './coverage-preview.js';
describe('coverage preview', () => {
  it('separa exactamente 5 y 6 días', () => {
    expect(previewCoverage({ start:'2026-08-01', end:'2026-08-05' }, DEFAULT_COVERAGE_POLICY).processType).toBe('ROTATION');
    expect(previewCoverage({ start:'2026-08-01', end:'2026-08-06' }, DEFAULT_COVERAGE_POLICY).processType).toBe('COMPETITION');
  });
});
