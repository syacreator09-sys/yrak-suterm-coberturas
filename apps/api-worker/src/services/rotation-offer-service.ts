import type { AppEnv } from '../env.js';
import { enqueueNotification } from './notification-service.js';

function sqliteDateTime(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toISOString().slice(0, 19).replace('T', ' ');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface OfferContext {
  organizationId: string;
  coverageCaseId: string;
  assignmentId: string;
  employeeId: string;
  targetLevelId: string;
  startsOn: string;
  endsOn: string;
  reason?: string | null;
  timeoutMinutes: number;
}

export async function createRotationOffer(env: AppEnv, ctx: OfferContext): Promise<void> {
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const tokenHash = await sha256Hex(token);
  const expiresAt = sqliteDateTime(ctx.timeoutMinutes * 60_000);
  await env.DB.prepare(
    `UPDATE temporary_assignments SET offer_expires_at=?, offer_token_hash=?, offer_notified_at=datetime('now'), version=version+1 WHERE id=?`,
  ).bind(expiresAt, tokenHash, ctx.assignmentId).run();

  const employee = await env.DB.prepare(`SELECT name, email FROM employees WHERE id=?`).bind(ctx.employeeId).first<{ name: string; email: string | null }>();
  const level = await env.DB.prepare(`SELECT name FROM levels WHERE id=?`).bind(ctx.targetLevelId).first<{ name: string }>();
  if (!employee) return;

  const base = env.PUBLIC_BASE_URL ?? 'http://localhost:8787';
  const acceptUrl = `${base}/offers/${ctx.assignmentId}/accept?token=${token}`;
  const rejectUrl = `${base}/offers/${ctx.assignmentId}/reject?token=${token}`;

  await enqueueNotification(env, {
    organizationId: ctx.organizationId,
    entityType: 'COVERAGE_CASE',
    entityId: ctx.coverageCaseId,
    recipient: employee.email,
    templateKey: 'ROTATION_OFFER',
    payload: {
      name: employee.name,
      targetLevel: level?.name ?? ctx.targetLevelId,
      titularAusente: ctx.reason ?? level?.name ?? `Nivel ${ctx.targetLevelId}`,
      startDate: ctx.startsOn,
      endDate: ctx.endsOn,
      expiresInMinutes: ctx.timeoutMinutes,
      acceptUrl,
      rejectUrl,
    },
  });
}

export type OfferTokenCheck =
  | { ok: true; employeeId: string; coverageCaseId: string }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'ALREADY_RESOLVED' | 'INVALID_TOKEN' };

export async function verifyOfferToken(env: AppEnv, assignmentId: string, token: string): Promise<OfferTokenCheck> {
  const row = await env.DB.prepare(
    `SELECT coverage_case_id, employee_id, status, offer_expires_at, offer_token_hash FROM temporary_assignments WHERE id=?`,
  ).bind(assignmentId).first<{ coverage_case_id: string; employee_id: string; status: string; offer_expires_at: string | null; offer_token_hash: string | null }>();
  if (!row || !row.offer_token_hash) return { ok: false, reason: 'NOT_FOUND' };
  if (row.status !== 'PROPOSED') return { ok: false, reason: 'ALREADY_RESOLVED' };
  const tokenHash = await sha256Hex(token);
  if (!timingSafeEqual(tokenHash, row.offer_token_hash)) return { ok: false, reason: 'INVALID_TOKEN' };
  if (!row.offer_expires_at || row.offer_expires_at < sqliteDateTime(0)) return { ok: false, reason: 'EXPIRED' };
  return { ok: true, employeeId: row.employee_id, coverageCaseId: row.coverage_case_id };
}

export async function findExpiredRotationOffers(env: AppEnv): Promise<Array<{ coverageCaseId: string; assignmentId: string; employeeId: string; organizationId: string }>> {
  const rows = await env.DB.prepare(
    `SELECT a.id assignment_id, a.coverage_case_id, a.employee_id, c.organization_id
     FROM temporary_assignments a JOIN coverage_cases c ON c.id = a.coverage_case_id
     WHERE a.status='PROPOSED' AND a.offer_expires_at IS NOT NULL AND a.offer_expires_at < datetime('now')`,
  ).all<{ assignment_id: string; coverage_case_id: string; employee_id: string; organization_id: string }>();
  return (rows.results ?? []).map((r) => ({
    coverageCaseId: r.coverage_case_id,
    assignmentId: r.assignment_id,
    employeeId: r.employee_id,
    organizationId: r.organization_id,
  }));
}
