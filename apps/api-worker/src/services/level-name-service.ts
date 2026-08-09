import type { AppEnv } from '../env.js';

export async function levelName(env: AppEnv, levelId: string): Promise<string> {
  const row = await env.DB.prepare(`SELECT name FROM levels WHERE id=?`).bind(levelId).first<{ name: string }>();
  return row?.name ?? levelId;
}
