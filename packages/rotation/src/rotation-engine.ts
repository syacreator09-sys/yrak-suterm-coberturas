import { DomainError } from '@yrak/domain';
import type { EmployeeId } from '@yrak/domain';
import type { RotationCandidate, RotationSelection } from './types.js';

function ordered(candidates: readonly RotationCandidate[]): RotationCandidate[] {
  return [...candidates].sort((left, right) => {
    if (left.position !== right.position) return left.position - right.position;
    return String(left.employeeId).localeCompare(String(right.employeeId));
  });
}

export function selectNextCandidate(candidates: readonly RotationCandidate[]): RotationSelection {
  const sorted = ordered(candidates);
  const selected = sorted.find((candidate) => candidate.availability === 'AVAILABLE');
  if (!selected) {
    throw new DomainError('NO_AVAILABLE_ROTATION_CANDIDATE', 'No existe candidato disponible');
  }
  return {
    selected,
    skipped: sorted.filter((candidate) => candidate.position < selected.position),
  };
}

export function reserveCandidate(
  candidates: readonly RotationCandidate[],
  employeeId: EmployeeId,
): RotationCandidate[] {
  return candidates.map((candidate) => {
    if (candidate.employeeId !== employeeId) return { ...candidate };
    if (candidate.availability !== 'AVAILABLE') {
      throw new DomainError('CANDIDATE_NOT_AVAILABLE', 'El candidato ya no está disponible', {
        employeeId,
        availability: candidate.availability,
      });
    }
    return { ...candidate, availability: 'RESERVED' as const };
  });
}

export function completeTurn(
  candidates: readonly RotationCandidate[],
  employeeId: EmployeeId,
  consumedTurn: boolean,
): RotationCandidate[] {
  const sorted = ordered(candidates);
  const selected = sorted.find((candidate) => candidate.employeeId === employeeId);
  if (!selected) {
    throw new DomainError('ROTATION_CANDIDATE_NOT_FOUND', 'El candidato no pertenece a la fila', {
      employeeId,
    });
  }
  const reordered = consumedTurn
    ? [...sorted.filter((candidate) => candidate.employeeId !== employeeId), selected]
    : sorted;
  return reordered.map((candidate, index) => ({
    ...candidate,
    position: index + 1,
    availability: candidate.employeeId === employeeId ? 'AVAILABLE' : candidate.availability,
  }));
}
