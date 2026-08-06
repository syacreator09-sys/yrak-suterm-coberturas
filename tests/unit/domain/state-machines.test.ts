import { describe, expect, it } from 'vitest';
import {
  assertAssignmentTransition,
  assertCoverageTransition,
} from '../../../packages/domain/src/index.js';

describe('state machines', () => {
  it('allows an active coverage to complete', () => {
    expect(() => assertCoverageTransition('ACTIVE', 'COMPLETED')).not.toThrow();
  });

  it('rejects completed coverage returning to active', () => {
    expect(() => assertCoverageTransition('COMPLETED', 'ACTIVE')).toThrowError(/inválida/i);
  });

  it('rejects completed assignment returning to active', () => {
    expect(() => assertAssignmentTransition('COMPLETED', 'ACTIVE')).toThrowError(/inválida/i);
  });
});
