import type { CalendarContext } from '@yrak/calendar';
import type { AppEnv } from '../env.js';
import { loadCalendarSettings } from './calendar-settings-service.js';

export async function loadCalendarContext(env: AppEnv, organizationId: string, groupId: string, startDate: string, endDate: string): Promise<CalendarContext> {
  const [holidayRows, shiftRows, settings] = await Promise.all([
    env.DB.prepare(`SELECT holiday_date FROM holidays WHERE organization_id=? AND (group_id=? OR group_id IS NULL) AND holiday_date BETWEEN ? AND ?`).bind(organizationId, groupId, startDate, endDate).all<{ holiday_date: string }>(),
    env.DB.prepare(`SELECT shift_date FROM group_shift_dates WHERE group_id=? AND scheduled=1 AND shift_date BETWEEN ? AND ?`).bind(groupId, startDate, endDate).all<{ shift_date: string }>(),
    loadCalendarSettings(env, organizationId, groupId, startDate),
  ]);
  const shiftDates = shiftRows.results ?? [];
  return {
    workingWeekdays: new Set(settings.config.workingWeekdays),
    holidays: new Set((holidayRows.results ?? []).map((r) => r.holiday_date)),
    ...(shiftDates.length ? { shiftDates: new Set(shiftDates.map((r) => r.shift_date)) } : {}),
  };
}
