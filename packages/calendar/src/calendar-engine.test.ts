import { describe, expect, it } from 'vitest';
import { countEffectiveDays } from './calendar-engine.js';

describe('countEffectiveDays', () => {
  it('cuenta días naturales inclusive', () => expect(countEffectiveDays({ start: '2026-08-01', end: '2026-08-05' }, 'CALENDAR_DAYS')).toBe(5));
  it('cuenta días laborales', () => expect(countEffectiveDays({ start: '2026-08-03', end: '2026-08-09' }, 'WORKING_DAYS')).toBe(5));
  it('usa turnos explícitos', () => expect(countEffectiveDays({ start: '2026-08-01', end: '2026-08-05' }, 'SHIFTS', { shiftDates: new Set(['2026-08-01','2026-08-03']) })).toBe(2));
});
