import { describe, expect, it } from 'vitest';
import type { EmployeeId } from '@yrak/domain';
import { rankCompetition, selectProvisionalWinner } from './competition-engine.js';

const e = (id: string) => id as EmployeeId;

describe('competition', () => {
  it('ordena por examen y luego antigüedad', () => {
    const ranking = rankCompetition({ minimumScore: 70, tieBreaker: 'SENIORITY', candidates: [
      { employeeId: e('a'), employeeNumber: '2', eligible: true, examScore: 90, seniorityDate: '2020-01-01' },
      { employeeId: e('b'), employeeNumber: '1', eligible: true, examScore: 90, seniorityDate: '2019-01-01' },
      { employeeId: e('c'), employeeNumber: '3', eligible: true, examScore: 60, seniorityDate: '2010-01-01' },
    ] });
    expect(ranking.map((x) => x.employeeId)).toEqual(['b','a']);
    expect(selectProvisionalWinner(ranking).employeeId).toBe('b');
  });
});
