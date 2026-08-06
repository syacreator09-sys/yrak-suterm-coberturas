import { describe, expect, it } from 'vitest';
import { asId } from '../../../packages/domain/src/index.js';
import { rankCandidates } from '../../../packages/competition/src/index.js';

const employee = (value: string) => asId<'EmployeeId'>(value);

describe('competition ranking', () => {
  it('orders by exam, critical section and seniority', () => {
    const ranked = rankCandidates(
      [
        { employeeId: employee('A'), examScore: 90, criticalSectionScore: 80, seniorityDate: '2020-01-01' },
        { employeeId: employee('B'), examScore: 95, criticalSectionScore: 70, seniorityDate: '2021-01-01' },
        { employeeId: employee('C'), examScore: 95, criticalSectionScore: 90, seniorityDate: '2022-01-01' },
      ],
      [{ type: 'CRITICAL_SECTION' }, { type: 'SENIORITY' }],
    );
    expect(ranked.map((candidate) => candidate.employeeId)).toEqual(['C', 'B', 'A']);
  });

  it('rejects scores outside 0–100', () => {
    expect(() =>
      rankCandidates(
        [{ employeeId: employee('A'), examScore: 101, seniorityDate: '2020-01-01' }],
        [],
      ),
    ).toThrowError(/0 y 100/i);
  });
});
