import { runMaintenance } from './maintenance.js';
import type { Env } from './types.js';

export interface CertifiedMaintenanceResult {
  base: Awaited<ReturnType<typeof runMaintenance>>;
  releasedCases: number;
  restoredQueueEntries: number;
}

export async function runCertifiedMaintenance(
  env: Env,
): Promise<CertifiedMaintenanceResult> {
  const base = await runMaintenance(env);
  const cancelled = await env.DB.prepare(`SELECT cc.id, cc.group_id,
      ta.employee_id, ta.base_level_id, ta.target_level_id, ta.status AS assignment_status
    FROM coverage_cases cc
    LEFT JOIN temporary_assignments ta ON ta.coverage_case_id = cc.id
    WHERE cc.status = 'CANCELLED'
      AND cc.updated_at >= datetime('now', '-30 days')
      AND (ta.id IS NULL OR ta.status NOT IN ('COMPLETED','CANCELLED','REPLACED'))`)
    .all<{
      id: string;
      group_id: string;
      employee_id: string | null;
      base_level_id: string | null;
      target_level_id: string | null;
      assignment_status: string | null;
    }>();

  const releasedCases = new Set<string>();
  let restoredQueueEntries = 0;
  for (const row of cancelled.results ?? []) {
    if (!releasedCases.has(row.id)) {
      await env.GROUP_COORDINATOR.getByName(row.group_id).release(row.id);
      releasedCases.add(row.id);
    }
    if (!row.employee_id || !row.base_level_id || !row.target_level_id) continue;
    const pool = await env.DB.prepare(`SELECT id FROM rotation_pools
      WHERE group_id = ? AND source_level_id = ? AND target_level_id = ?`)
      .bind(row.group_id, row.base_level_id, row.target_level_id)
      .first<{ id: string }>();
    if (!pool) continue;
    const entry = await env.DB.prepare(`SELECT availability, queue_position
      FROM rotation_queue_entries WHERE pool_id = ? AND employee_id = ?`)
      .bind(pool.id, row.employee_id)
      .first<{ availability: string; queue_position: number }>();
    if (entry && ['RESERVED', 'ASSIGNED'].includes(entry.availability)) {
      await env.DB.batch([
        env.DB.prepare(`UPDATE rotation_queue_entries
          SET availability = 'AVAILABLE', version = version + 1, updated_at = datetime('now')
          WHERE pool_id = ? AND employee_id = ?`)
          .bind(pool.id, row.employee_id),
        env.DB.prepare(`UPDATE temporary_assignments
          SET status = 'CANCELLED', version = version + 1, updated_at = datetime('now')
          WHERE coverage_case_id = ? AND employee_id = ?
            AND status NOT IN ('COMPLETED','CANCELLED','REPLACED')`)
          .bind(row.id, row.employee_id),
        env.DB.prepare(`INSERT INTO rotation_events (
          id, pool_id, employee_id, coverage_case_id, event_type,
          previous_position, new_position, reason
        ) VALUES (?, ?, ?, ?, 'RESTORED', ?, ?, 'Reconciliación automática de cancelación')`)
          .bind(
            crypto.randomUUID(),
            pool.id,
            row.employee_id,
            row.id,
            entry.queue_position,
            entry.queue_position,
          ),
      ]);
      restoredQueueEntries++;
    }
  }

  const result = {
    base,
    releasedCases: releasedCases.size,
    restoredQueueEntries,
  };
  console.log(JSON.stringify({ event: 'maintenance.certified.completed', ...result }));
  return result;
}
