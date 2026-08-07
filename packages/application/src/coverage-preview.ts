import { countEffectiveDays, type CalendarContext } from '@yrak/calendar';
import { determineCoverageProcess, type CoveragePolicyConfig, type DateRange } from '@yrak/domain';

export interface CoveragePreview {
  period: DateRange;
  effectiveDays: number;
  processType: 'ROTATION' | 'COMPETITION';
  dayCountingMode: CoveragePolicyConfig['dayCountingMode'];
}

export function previewCoverage(period: DateRange, policy: CoveragePolicyConfig, calendar: CalendarContext = {}): CoveragePreview {
  const effectiveDays = countEffectiveDays(period, policy.dayCountingMode, calendar);
  return { period, effectiveDays, processType: determineCoverageProcess(effectiveDays, policy), dayCountingMode: policy.dayCountingMode };
}
