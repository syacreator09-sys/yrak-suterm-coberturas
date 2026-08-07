import type { DateRange } from '@yrak/domain';
import type { DayCountingMode } from '@yrak/domain';
import { DomainError } from '@yrak/domain';

export interface CalendarContext {
  workingWeekdays?: ReadonlySet<number>;
  holidays?: ReadonlySet<string>;
  shiftDates?: ReadonlySet<string>;
}

function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DomainError('INVALID_DATE', `Fecha inválida: ${value}`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new DomainError('INVALID_DATE', `Fecha inválida: ${value}`);
  return date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function enumerateDates(range: DateRange): string[] {
  const start = parseDateOnly(range.start);
  const end = parseDateOnly(range.end);
  if (end < start) throw new DomainError('INVALID_DATE_RANGE', 'La fecha final no puede ser anterior a la inicial');
  const dates: string[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) dates.push(isoDate(cursor));
  return dates;
}

export function countEffectiveDays(range: DateRange, mode: DayCountingMode, context: CalendarContext = {}): number {
  const dates = enumerateDates(range);
  if (mode === 'CALENDAR_DAYS') return dates.length;
  if (mode === 'SHIFTS') {
    if (!context.shiftDates) throw new DomainError('SHIFT_CALENDAR_REQUIRED', 'Se requiere calendario de turnos');
    return dates.filter((date) => context.shiftDates?.has(date)).length;
  }
  const weekdays = context.workingWeekdays ?? new Set([1, 2, 3, 4, 5]);
  const holidays = context.holidays ?? new Set<string>();
  return dates.filter((value) => {
    if (holidays.has(value)) return false;
    const weekday = parseDateOnly(value).getUTCDay();
    return weekdays.has(weekday);
  }).length;
}
