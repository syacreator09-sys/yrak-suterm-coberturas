import { describe, expect, it } from 'vitest';
import { determineCoverageProcess } from './coverage-policy.js';

 describe('determineCoverageProcess', () => {
  it('usa rotación del día 1 al 5', () => {
    expect(determineCoverageProcess(1)).toBe('ROTATION');
    expect(determineCoverageProcess(5)).toBe('ROTATION');
  });

  it('usa concurso desde el día 6', () => {
    expect(determineCoverageProcess(6)).toBe('COMPETITION');
    expect(determineCoverageProcess(30)).toBe('COMPETITION');
  });

  it('rechaza duraciones inválidas', () => {
    expect(() => determineCoverageProcess(0)).toThrow();
    expect(() => determineCoverageProcess(-1)).toThrow();
    expect(() => determineCoverageProcess(2.5)).toThrow();
  });
});
