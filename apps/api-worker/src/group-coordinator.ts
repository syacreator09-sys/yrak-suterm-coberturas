import { DurableObject } from 'cloudflare:workers';
import type { AppEnv } from './env.js';

export class GroupCoordinator extends DurableObject<AppEnv> {
  constructor(ctx: DurableObjectState, env: AppEnv) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS reservations (
      employee_id TEXT PRIMARY KEY,
      coverage_case_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    )`);
  }

  async reserve(employeeId: string, coverageCaseId: string, ttlMs = 15 * 60_000): Promise<{ reserved: boolean; existingCaseId?: string }> {
    const now = Date.now();
    this.ctx.storage.sql.exec('DELETE FROM reservations WHERE expires_at <= ?', now);
    const existing = this.ctx.storage.sql.exec<{ coverage_case_id: string }>('SELECT coverage_case_id FROM reservations WHERE employee_id = ?', employeeId).oneOrNone();
    if (existing && existing.coverage_case_id !== coverageCaseId) return { reserved: false, existingCaseId: existing.coverage_case_id };
    this.ctx.storage.sql.exec(`INSERT INTO reservations (employee_id, coverage_case_id, expires_at) VALUES (?, ?, ?)
      ON CONFLICT(employee_id) DO UPDATE SET coverage_case_id = excluded.coverage_case_id, expires_at = excluded.expires_at`, employeeId, coverageCaseId, now + ttlMs);
    return { reserved: true };
  }

  async release(employeeId: string, coverageCaseId: string): Promise<void> {
    this.ctx.storage.sql.exec('DELETE FROM reservations WHERE employee_id = ? AND coverage_case_id = ?', employeeId, coverageCaseId);
  }
}
