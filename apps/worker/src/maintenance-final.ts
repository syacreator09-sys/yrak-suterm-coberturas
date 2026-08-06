import { runCertifiedMaintenance } from './maintenance-certified.js';
import type { Env } from './types.js';

export async function runFinalMaintenance(env: Env): Promise<Record<string, unknown>> {
  const certified = await runCertifiedMaintenance(env);
  const expiredClaims = await env.DB.prepare(
    `DELETE FROM intake_review_claims
    WHERE expires_at < datetime('now')`,
  ).run();
  const result = {
    ...certified,
    expiredIntakeClaims: Number(
      (expiredClaims.meta as { changes?: number } | undefined)?.changes ?? 0,
    ),
  };
  console.log(JSON.stringify({ event: 'maintenance.final.completed', ...result }));
  return result;
}
