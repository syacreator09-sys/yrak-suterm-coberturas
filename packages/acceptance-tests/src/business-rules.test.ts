import { describe, expect, it } from 'vitest';
import { DEFAULT_COVERAGE_POLICY, determineCoverageProcess } from '@yrak/domain';
import { moveCompletedCandidateToEnd, selectNextCandidate } from '@yrak/rotation';
import { evaluateEligibility } from '@yrak/eligibility';
import { rankCompetition } from '@yrak/competition';

const employee = (id: string, position: number, availability: 'AVAILABLE' | 'UNAVAILABLE' = 'AVAILABLE') => ({
  employeeId: id as any,
  position,
  availability,
});

describe('YRAK confirmed business rules', () => {
  it('classifies exactly 1–5 effective days as rotation', () => {
    for (const days of [1, 2, 3, 4, 5]) {
      expect(determineCoverageProcess(days, DEFAULT_COVERAGE_POLICY)).toBe('ROTATION');
    }
  });

  it('classifies 6+ effective days as competition', () => {
    for (const days of [6, 7, 14, 30]) {
      expect(determineCoverageProcess(days, DEFAULT_COVERAGE_POLICY)).toBe('COMPETITION');
    }
  });

  it('short rotation selects the first available candidate, not an unavailable one', () => {
    const result = selectNextCandidate([
      employee('E1', 1, 'UNAVAILABLE'),
      employee('E2', 2),
      employee('E3', 3),
    ] as any);
    expect(String(result.selected.employeeId)).toBe('E2');
  });

  it('moves the employee who completed a short coverage to the end', () => {
    const after = moveCompletedCandidateToEnd(
      [employee('E1', 1), employee('E2', 2), employee('E3', 3)] as any,
      'E1' as any,
    );
    expect(after.map((item) => String(item.employeeId))).toEqual(['E2', 'E3', 'E1']);
    expect(after.map((item) => item.position)).toEqual([1, 2, 3]);
  });

  it('does not consider a long-coverage candidate eligible when a mandatory requirement is missing', () => {
    const result = evaluateEligibility({
      employeeId: 'E1' as any,
      coverageStart: '2026-08-10',
      coverageEnd: '2026-08-20',
      requirements: [
        { id: 'R1' as any, mandatory: true, validForEntireCoverage: true },
      ],
      records: [],
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('does not accept a requirement that expires before the long coverage ends when full-period validity is required', () => {
    const result = evaluateEligibility({
      employeeId: 'E1' as any,
      coverageStart: '2026-08-10',
      coverageEnd: '2026-08-20',
      requirements: [
        { id: 'R1' as any, mandatory: true, validForEntireCoverage: true },
      ],
      records: [
        { requirementId: 'R1' as any, status: 'COMPLIANT', validUntil: '2026-08-15' },
      ],
    });
    expect(result.eligible).toBe(false);
  });

  it('ranks a competition by exam score and only then by the configured tie breaker', () => {
    const ranking = rankCompetition({
      minimumScore: 70,
      tieBreaker: 'SENIORITY',
      candidates: [
        { employeeId: 'E1' as any, employeeNumber: '20', eligible: true, examScore: 90, seniorityDate: '2020-01-01' },
        { employeeId: 'E2' as any, employeeNumber: '10', eligible: true, examScore: 95, seniorityDate: '2022-01-01' },
        { employeeId: 'E3' as any, employeeNumber: '30', eligible: true, examScore: 90, seniorityDate: '2018-01-01' },
      ],
    });
    expect(ranking.map((item) => String(item.employeeId))).toEqual(['E2', 'E3', 'E1']);
  });
});
