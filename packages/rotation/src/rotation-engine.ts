import { DomainError } from '@yrak/domain';
import type { AvailabilityStatus, EmployeeId } from '@yrak/domain';

export interface RotationCandidate {
  employeeId: EmployeeId;
  position: number;
  availability: AvailabilityStatus;
  unavailableReason?: string;
}

export interface RotationSelection {
  selected: RotationCandidate;
  considered: Array<{ employeeId: EmployeeId; position: number; selected: boolean; reason?: string }>;
}

export function selectNextCandidate(candidates: readonly RotationCandidate[]): RotationSelection {
  const ordered = [...candidates].sort((a, b) => a.position - b.position || String(a.employeeId).localeCompare(String(b.employeeId)));
  const selected = ordered.find((candidate) => candidate.availability === 'AVAILABLE');
  if (!selected) throw new DomainError('NO_ROTATION_CANDIDATE', 'No existe candidato disponible en la fila');
  return {
    selected,
    considered: ordered.map((candidate) => ({
      employeeId: candidate.employeeId,
      position: candidate.position,
      selected: candidate.employeeId === selected.employeeId,
      ...(candidate.availability !== 'AVAILABLE' ? { reason: candidate.unavailableReason ?? candidate.availability } : {}),
    })),
  };
}

export function moveCompletedCandidateToEnd(candidates: readonly RotationCandidate[], employeeId: EmployeeId): RotationCandidate[] {
  const ordered = [...candidates].sort((a, b) => a.position - b.position);
  const target = ordered.find((candidate) => candidate.employeeId === employeeId);
  if (!target) throw new DomainError('ROTATION_MEMBER_NOT_FOUND', 'El trabajador no pertenece a la fila');
  const remaining = ordered.filter((candidate) => candidate.employeeId !== employeeId);
  return [...remaining, target].map((candidate, index) => ({ ...candidate, position: index + 1 }));
}

export function preserveQueueOnPreStartCancellation(candidates: readonly RotationCandidate[]): RotationCandidate[] {
  return [...candidates].sort((a, b) => a.position - b.position).map((candidate) => ({ ...candidate }));
}
