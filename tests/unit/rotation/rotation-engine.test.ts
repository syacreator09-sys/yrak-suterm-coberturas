import { describe, expect, it } from 'vitest';
import { asId } from '../../../packages/domain/src/index.js';
import {
  completeTurn,
  reserveCandidate,
  selectNextCandidate,
} from '../../../packages/rotation/src/index.js';

const employee = (value: string) => asId<'EmployeeId'>(value);

describe('rotation engine', () => {
  const queue = [
    { employeeId: employee('A'), position: 1, availability: 'UNAVAILABLE' as const },
    { employeeId: employee('B'), position: 2, availability: 'AVAILABLE' as const },
    { employeeId: employee('C'), position: 3, availability: 'AVAILABLE' as const },
  ];

  it('selects first available and records skipped candidates', () => {
    const result = selectNextCandidate(queue);
    expect(result.selected.employeeId).toBe('B');
    expect(result.skipped.map((candidate) => candidate.employeeId)).toEqual(['A']);
  });

  it('reserves selected candidate', () => {
    expect(reserveCandidate(queue, employee('B'))[1]?.availability).toBe('RESERVED');
  });

  it('moves consumed turn to queue end', () => {
    const result = completeTurn(queue, employee('B'), true);
    expect(result.map((candidate) => candidate.employeeId)).toEqual(['A', 'C', 'B']);
  });

  it('preserves order when cancelled before start', () => {
    const result = completeTurn(queue, employee('B'), false);
    expect(result.map((candidate) => candidate.employeeId)).toEqual(['A', 'B', 'C']);
  });
});
