import { describe, expect, it } from 'vitest';
import type { LevelId } from '@yrak/domain';
import { planCoverageChain, rangesOverlap } from './assignment-engine.js';
const l = (id: string) => id as LevelId;

describe('assignment engine', () => {
  it('planea cadena 7→8, 6→7, 5→6', () => {
    const steps = planCoverageChain(l('8'), [
      { sourceLevelId: l('7'), targetLevelId: l('8'), active: true },
      { sourceLevelId: l('6'), targetLevelId: l('7'), active: true },
      { sourceLevelId: l('5'), targetLevelId: l('6'), active: true },
    ]);
    expect(steps.map((x) => `${x.sourceLevelId}->${x.targetLevelId}`)).toEqual(['7->8','6->7','5->6']);
  });
  it('detecta traslapes inclusivos', () => expect(rangesOverlap({ start:'2026-08-01', end:'2026-08-05' }, { start:'2026-08-05', end:'2026-08-10' })).toBe(true));
});
