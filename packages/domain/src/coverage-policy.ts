import { InvalidCoverageDurationError } from './errors.js';
import type { CoveragePolicyConfig } from './types.js';
import type { CoverageProcessType } from './enums.js';

export const DEFAULT_COVERAGE_POLICY: CoveragePolicyConfig = {
  shortCoverageMaximumDays: 5,
  longCoverageMinimumDays: 6,
  dayCountingMode: 'CALENDAR_DAYS',
  rejectionConsumesTurn: true,
};

export function assertCoveragePolicy(config: CoveragePolicyConfig): void {
  if (config.shortCoverageMaximumDays < 1) throw new Error('shortCoverageMaximumDays must be >= 1');
  if (config.longCoverageMinimumDays !== config.shortCoverageMaximumDays + 1) {
    throw new Error('Coverage thresholds must be contiguous');
  }
}

export function determineCoverageProcess(days: number, config: CoveragePolicyConfig = DEFAULT_COVERAGE_POLICY): CoverageProcessType {
  assertCoveragePolicy(config);
  if (!Number.isInteger(days) || days <= 0) throw new InvalidCoverageDurationError(days);
  return days <= config.shortCoverageMaximumDays ? 'ROTATION' : 'COMPETITION';
}
