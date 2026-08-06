import { DomainError } from '@yrak/domain';
import type { EmployeeId } from '@yrak/domain';

export interface CandidateScore {
  employeeId: EmployeeId;
  examScore: number;
  seniorityDate: string;
  criticalSectionScore?: number;
}

export type TieBreakerRule =
  | { type: 'CRITICAL_SECTION' }
  | { type: 'SENIORITY' }
  | { type: 'EMPLOYEE_ID' };

export interface RankedCandidate extends CandidateScore {
  rank: number;
}

function validateScore(score: number, label: string): void {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new DomainError('INVALID_EXAM_SCORE', `${label} debe estar entre 0 y 100`, { score });
  }
}

export function rankCandidates(
  candidates: readonly CandidateScore[],
  tieBreakers: readonly TieBreakerRule[],
): RankedCandidate[] {
  for (const candidate of candidates) {
    validateScore(candidate.examScore, 'La calificación del examen');
    if (candidate.criticalSectionScore !== undefined) {
      validateScore(candidate.criticalSectionScore, 'La sección crítica');
    }
  }

  const sorted = [...candidates].sort((left, right) => {
    const examDifference = right.examScore - left.examScore;
    if (examDifference !== 0) return examDifference;

    for (const rule of tieBreakers) {
      if (rule.type === 'CRITICAL_SECTION') {
        const difference = (right.criticalSectionScore ?? -1) - (left.criticalSectionScore ?? -1);
        if (difference !== 0) return difference;
      }
      if (rule.type === 'SENIORITY') {
        const difference = new Date(left.seniorityDate).getTime() - new Date(right.seniorityDate).getTime();
        if (difference !== 0) return difference;
      }
      if (rule.type === 'EMPLOYEE_ID') {
        const difference = String(left.employeeId).localeCompare(String(right.employeeId));
        if (difference !== 0) return difference;
      }
    }
    return String(left.employeeId).localeCompare(String(right.employeeId));
  });

  return sorted.map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}
