import type { CoverageProcessType, DayCountingMode } from '../enums.js';
import { DomainError } from '../errors.js';

export interface CoveragePolicyConfig {
  shortCoverageMaximumDays: number;
  longCoverageMinimumDays: number;
  dayCountingMode: DayCountingMode;
}

export const defaultCoveragePolicy: CoveragePolicyConfig = {
  shortCoverageMaximumDays: 5,
  longCoverageMinimumDays: 6,
  dayCountingMode: 'CALENDAR_DAYS',
};

export function validateCoveragePolicy(config: CoveragePolicyConfig): void {
  if (config.shortCoverageMaximumDays < 1) {
    throw new DomainError('INVALID_POLICY', 'El máximo de cobertura corta debe ser positivo');
  }
  if (config.longCoverageMinimumDays !== config.shortCoverageMaximumDays + 1) {
    throw new DomainError(
      'INVALID_POLICY_GAP',
      'Los umbrales de rotación y concurso deben ser consecutivos y no traslaparse',
      config,
    );
  }
}

export function determineCoverageProcess(
  days: number,
  config: CoveragePolicyConfig = defaultCoveragePolicy,
): CoverageProcessType {
  validateCoveragePolicy(config);
  if (!Number.isInteger(days) || days < 1) {
    throw new DomainError('INVALID_DURATION', 'La duración debe ser un entero positivo', { days });
  }
  return days <= config.shortCoverageMaximumDays ? 'ROTATION' : 'COMPETITION';
}

export function countCalendarDays(startsAt: string, endsAt: string): number {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new DomainError('INVALID_DATE_RANGE', 'El periodo de cobertura no es válido', {
      startsAt,
      endsAt,
    });
  }
  const millisecondsPerDay = 86_400_000;
  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
}
