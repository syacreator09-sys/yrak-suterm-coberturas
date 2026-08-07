import { describe, expect, it } from 'vitest';
import { moveCompletedCandidateToEnd, selectNextCandidate } from './rotation-engine.js';
import type { EmployeeId } from '@yrak/domain';

const e = (id: string) => id as EmployeeId;

describe('rotation engine', () => {
  it('selecciona el primero disponible y documenta saltos', () => {
    const result = selectNextCandidate([
      { employeeId: e('a'), position: 1, availability: 'UNAVAILABLE', unavailableReason: 'VACATION' },
      { employeeId: e('b'), position: 2, availability: 'AVAILABLE' },
      { employeeId: e('c'), position: 3, availability: 'AVAILABLE' },
    ]);
    expect(result.selected.employeeId).toBe('b');
    expect(result.considered[0]?.reason).toBe('VACATION');
  });

  it('mueve al final sólo al completar', () => {
    const next = moveCompletedCandidateToEnd([
      { employeeId: e('a'), position: 1, availability: 'AVAILABLE' },
      { employeeId: e('b'), position: 2, availability: 'AVAILABLE' },
      { employeeId: e('c'), position: 3, availability: 'AVAILABLE' },
    ], e('a'));
    expect(next.map((x) => x.employeeId)).toEqual(['b','c','a']);
  });
});
