import { describe, expect, it } from 'vitest';
import { asId } from '../../../packages/domain/src/index.js';
import { planCoverageChain } from '../../../packages/assignments/src/index.js';

const level = (value: string) => asId<'LevelId'>(value);

describe('coverage chain', () => {
  it('plans 7→8, 6→7 and 5→6', () => {
    const steps = planCoverageChain({
      vacantLevelId: level('8'),
      stopAfterSourceLevelId: level('5'),
      transitions: [
        { sourceLevelId: level('7'), targetLevelId: level('8'), active: true },
        { sourceLevelId: level('6'), targetLevelId: level('7'), active: true },
        { sourceLevelId: level('5'), targetLevelId: level('6'), active: true },
      ],
    });
    expect(steps.map((step) => `${step.sourceLevelId}->${step.targetLevelId}`)).toEqual([
      '7->8',
      '6->7',
      '5->6',
    ]);
  });
});
