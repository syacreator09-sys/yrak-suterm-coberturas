import type { AppEnv } from '../env.js';

export async function getSingleSourceLevel(env: AppEnv, groupId: string, targetLevelId: string): Promise<string> {
  const result = await env.DB.prepare(`SELECT lt.source_level_id FROM level_transitions lt
    JOIN levels source ON source.id = lt.source_level_id
    WHERE lt.group_id = ? AND lt.target_level_id = ? AND lt.active = 1
    ORDER BY source.rank_order DESC`).bind(groupId, targetLevelId).all<{ source_level_id:string }>();
  const rows = result.results ?? [];
  if (rows.length === 0) throw new Error('SOURCE_LEVEL_NOT_CONFIGURED');
  if (rows.length > 1) throw new Error('AMBIGUOUS_SOURCE_LEVEL');
  return rows[0]!.source_level_id;
}
