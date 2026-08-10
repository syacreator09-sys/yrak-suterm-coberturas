import type { AppEnv, AuthUser } from '../env.js';

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sqliteDateTime(msFromNow: number): string {
  return new Date(Date.now() + msFromNow).toISOString().slice(0, 19).replace('T', ' ');
}

export async function createGuestSession(
  env: AppEnv,
  organizationId: string,
  createdBy: string,
  ttlMinutes: number,
  label: string | null,
): Promise<{ token: string; expiresAt: string }> {
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const tokenHash = await sha256Hex(token);
  const expiresAt = sqliteDateTime(ttlMinutes * 60_000);
  await env.DB.prepare(
    `INSERT INTO guest_sessions(id,organization_id,token_hash,created_by,label,expires_at) VALUES(?,?,?,?,?,?)`,
  ).bind(crypto.randomUUID(), organizationId, tokenHash, createdBy, label, expiresAt).run();
  return { token, expiresAt };
}

export async function verifyGuestToken(env: AppEnv, token: string): Promise<AuthUser | null> {
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT id, organization_id FROM guest_sessions WHERE token_hash=? AND revoked_at IS NULL AND expires_at > datetime('now')`,
  ).bind(tokenHash).first<{ id: string; organization_id: string }>();
  if (!row) return null;
  return { id: `guest:${row.id}`, organizationId: row.organization_id, email: 'invitado@yrak.local', role: 'AUDITOR' };
}
