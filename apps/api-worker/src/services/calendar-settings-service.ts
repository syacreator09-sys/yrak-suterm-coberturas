import type { AppEnv } from '../env.js';

export interface CalendarSettingsConfig { workingWeekdays: number[] }
export const DEFAULT_CALENDAR_SETTINGS: CalendarSettingsConfig = { workingWeekdays: [1, 2, 3, 4, 5] };

export async function loadCalendarSettings(env: AppEnv, organizationId: string, groupId: string, atDate: string): Promise<{ config: CalendarSettingsConfig; id: string | null }> {
  const row = await env.DB.prepare(`SELECT id, config_json FROM group_policies
    WHERE organization_id = ? AND (group_id = ? OR group_id IS NULL) AND policy_key = 'CALENDAR_SETTINGS'
      AND effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)
    ORDER BY CASE WHEN group_id = ? THEN 0 ELSE 1 END, version DESC LIMIT 1`)
    .bind(organizationId, groupId, atDate, atDate, groupId)
    .first<{ id: string; config_json: string }>();
  if (!row) return { config: DEFAULT_CALENDAR_SETTINGS, id: null };
  return { config: { ...DEFAULT_CALENDAR_SETTINGS, ...(JSON.parse(row.config_json) as Partial<CalendarSettingsConfig>) }, id: row.id };
}
