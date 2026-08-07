import type { CalendarContext } from '@yrak/calendar';
import type { AppEnv } from '../env.js';

export async function loadCalendarContext(env: AppEnv, organizationId: string, groupId: string, startDate: string, endDate: string): Promise<CalendarContext> {
  const holidayRows = await env.DB.prepare(`SELECT holiday_date FROM holidays WHERE organization_id=? AND (group_id=? OR group_id IS NULL) AND holiday_date BETWEEN ? AND ?`).bind(organizationId,groupId,startDate,endDate).all<{holiday_date:string}>();
  const shiftRows = await env.DB.prepare(`SELECT shift_date FROM group_shift_dates WHERE group_id=? AND scheduled=1 AND shift_date BETWEEN ? AND ?`).bind(groupId,startDate,endDate).all<{shift_date:string}>();
  return { holidays:new Set((holidayRows.results??[]).map(r=>r.holiday_date)), shiftDates:new Set((shiftRows.results??[]).map(r=>r.shift_date)) };
}
