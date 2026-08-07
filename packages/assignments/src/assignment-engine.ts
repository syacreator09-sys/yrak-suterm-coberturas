import { DomainError } from '@yrak/domain';
import type { DateRange, Employee, LevelId } from '@yrak/domain';

export interface LevelTransition { sourceLevelId: LevelId; targetLevelId: LevelId; active: boolean }
export interface CoverageChainStep { sourceLevelId: LevelId; targetLevelId: LevelId; order: number }

export function assertAuthorizedTransition(sourceLevelId: LevelId, targetLevelId: LevelId, transitions: readonly LevelTransition[]): void {
  if (!transitions.some((item) => item.active && item.sourceLevelId === sourceLevelId && item.targetLevelId === targetLevelId)) {
    throw new DomainError('LEVEL_TRANSITION_NOT_ALLOWED', `Transición no autorizada: ${String(sourceLevelId)} -> ${String(targetLevelId)}`);
  }
}

export function assertBaseLevelUnchanged(employee: Employee, sourceLevelId: LevelId): void {
  if (employee.baseLevelId !== sourceLevelId) throw new DomainError('BASE_LEVEL_MISMATCH', 'El nivel de origen debe coincidir con el nivel base del trabajador');
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

export function assertNoAssignmentConflict(period: DateRange, existing: readonly DateRange[]): void {
  if (existing.some((item) => rangesOverlap(period, item))) throw new DomainError('ASSIGNMENT_CONFLICT', 'Existe una asignación o indisponibilidad traslapada');
}

export function planCoverageChain(targetLevelId: LevelId, transitions: readonly LevelTransition[], maximumDepth = 10): CoverageChainStep[] {
  const active = transitions.filter((item) => item.active);
  const result: CoverageChainStep[] = [];
  let currentTarget = targetLevelId;
  const visited = new Set<string>();
  for (let order = 1; order <= maximumDepth; order += 1) {
    const edge = active.find((item) => item.targetLevelId === currentTarget);
    if (!edge) break;
    const key = `${String(edge.sourceLevelId)}>${String(edge.targetLevelId)}`;
    if (visited.has(key)) throw new DomainError('LEVEL_TRANSITION_CYCLE', 'Se detectó un ciclo de transiciones');
    visited.add(key);
    result.push({ sourceLevelId: edge.sourceLevelId, targetLevelId: edge.targetLevelId, order });
    currentTarget = edge.sourceLevelId;
  }
  return result;
}
