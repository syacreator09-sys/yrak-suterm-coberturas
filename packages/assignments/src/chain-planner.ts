import { DomainError } from '@yrak/domain';
import type { LevelId, LevelTransition } from '@yrak/domain';

export interface CoverageChainStep {
  sourceLevelId: LevelId;
  targetLevelId: LevelId;
  order: number;
}

export interface ChainPlanInput {
  vacantLevelId: LevelId;
  transitions: readonly LevelTransition[];
  stopAfterSourceLevelId?: LevelId;
}

export function planCoverageChain(input: ChainPlanInput): CoverageChainStep[] {
  const activeTransitions = input.transitions.filter((transition) => transition.active);
  const steps: CoverageChainStep[] = [];
  const visited = new Set<LevelId>();
  let target = input.vacantLevelId;

  while (true) {
    if (visited.has(target)) {
      throw new DomainError(
        'CYCLIC_LEVEL_TRANSITION',
        'Las transiciones de niveles contienen un ciclo',
      );
    }
    visited.add(target);
    const transition = activeTransitions.find((candidate) => candidate.targetLevelId === target);
    if (!transition) break;
    steps.push({
      sourceLevelId: transition.sourceLevelId,
      targetLevelId: transition.targetLevelId,
      order: steps.length + 1,
    });
    if (transition.sourceLevelId === input.stopAfterSourceLevelId) break;
    target = transition.sourceLevelId;
  }

  if (steps.length === 0) {
    throw new DomainError(
      'NO_AUTHORIZED_LEVEL_TRANSITION',
      'No existe nivel autorizado para cubrir la vacante',
      {
        vacantLevelId: input.vacantLevelId,
      },
    );
  }
  return steps;
}
