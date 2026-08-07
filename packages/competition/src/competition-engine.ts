import type { EmployeeId } from '@yrak/domain';
import { DomainError } from '@yrak/domain';

export type TieBreaker = 'SENIORITY' | 'EMPLOYEE_NUMBER';

export interface CompetitionCandidateScore {
  employeeId: EmployeeId;
  employeeNumber: string;
  eligible: boolean;
  examScore?: number;
  seniorityDate?: string;
}

export interface RankedCandidate extends CompetitionCandidateScore { rank: number }

export function rankCompetition(input: { candidates: readonly CompetitionCandidateScore[]; minimumScore: number; tieBreaker: TieBreaker }): RankedCandidate[] {
  if (input.minimumScore < 0 || input.minimumScore > 100) throw new DomainError('INVALID_MINIMUM_SCORE', 'La calificación mínima debe estar entre 0 y 100');
  const eligible = input.candidates.filter((candidate) => candidate.eligible && candidate.examScore !== undefined && candidate.examScore >= input.minimumScore);
  for (const candidate of eligible) {
    if (candidate.examScore === undefined || candidate.examScore < 0 || candidate.examScore > 100) throw new DomainError('INVALID_EXAM_SCORE', 'Calificación fuera de rango');
  }
  const sorted = [...eligible].sort((a, b) => {
    const scoreDiff = (b.examScore ?? 0) - (a.examScore ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    if (input.tieBreaker === 'SENIORITY') {
      const aDate = a.seniorityDate ?? '9999-12-31';
      const bDate = b.seniorityDate ?? '9999-12-31';
      const dateDiff = aDate.localeCompare(bDate);
      if (dateDiff !== 0) return dateDiff;
    }
    return a.employeeNumber.localeCompare(b.employeeNumber);
  });
  return sorted.map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

export function selectProvisionalWinner(ranking: readonly RankedCandidate[]): RankedCandidate {
  const winner = ranking[0];
  if (!winner) throw new DomainError('NO_COMPETITION_WINNER', 'No existe candidato con resultado aprobatorio');
  return winner;
}
