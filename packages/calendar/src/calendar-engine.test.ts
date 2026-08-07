import { describe, expect, it } from 'vitest';
import { computeCountedDates, countEffectiveDays } from './calendar-engine.js';

describe('calendar engine', () => {
  it('cuenta días naturales inclusive', () => expect(countEffectiveDays({ start: '2026-08-01', end: '2026-08-05' }, 'CALENDAR_DAYS')).toBe(5));
  it('cuenta días laborales y excluye feriados', () => expect(computeCountedDates({ start: '2026-08-03', end: '2026-08-09' }, 'WORKING_DAYS', { holidays: new Set(['2026-08-05']) })).toEqual(['2026-08-03','2026-08-04','2026-08-06','2026-08-07']));
  it('usa turnos explícitos', () => expect(computeCountedDates({ start: '2026-08-01', end: '2026-08-05' }, 'SHIFTS', { shiftDates: new Set(['2026-08-01','2026-08-03']) })).toEqual(['2026-08-01','2026-08-03']));
  it('rechaza fechas inexistentes', () => expect(() => countEffectiveDays({ start:'2026-02-30', end:'2026-03-02' }, 'CALENDAR_DAYS')).toThrow());
});
