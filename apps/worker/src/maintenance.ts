import { sweepOutbox } from './outbox.js';
import type { Env } from './types.js';

export interface MaintenanceResult {
  recoveredOutbox: number;
  queuedOutbox: number;
  expiredIdempotencyKeys: number;
  expiredRequirements: number;
}

function changes(result: D1Result<unknown>): number {
  return Number((result.meta as { changes?: number } | undefined)?.changes ?? 0);
}

export async function runMaintenance(env: Env): Promise<MaintenanceResult> {
  const recovered = await env.DB.prepare(`UPDATE outbox_events
    SET status = 'FAILED', available_at = datetime('now'), locked_at = NULL
    WHERE status = 'PROCESSING'
      AND locked_at IS NOT NULL
      AND locked_at < datetime('now', '-10 minutes')`)
    .run();

  const expiredKeys = await env.DB.prepare(
    "DELETE FROM idempotency_keys WHERE expires_at < datetime('now')",
  ).run();

  const expiredRequirements = await env.DB.prepare(`UPDATE employee_requirements
    SET status = 'EXPIRED'
    WHERE status = 'COMPLIANT'
      AND valid_until IS NOT NULL
      AND valid_until < datetime('now')`)
    .run();

  const queuedOutbox = await sweepOutbox(env);
  const result: MaintenanceResult = {
    recoveredOutbox: changes(recovered),
    queuedOutbox,
    expiredIdempotencyKeys: changes(expiredKeys),
    expiredRequirements: changes(expiredRequirements),
  };
  console.log(JSON.stringify({ event: 'maintenance.completed', ...result }));
  return result;
}
