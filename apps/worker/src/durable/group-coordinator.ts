import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../types.js';

export interface ReservationInput {
  employeeId: string;
  coverageCaseId: string;
  startsAt: string;
  endsAt: string;
}

export interface ReservationResult {
  reserved: boolean;
  conflictCoverageCaseId?: string;
}

export class GroupCoordinator extends DurableObject<Env> {
  public constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS reservations (
        employee_id TEXT NOT NULL,
        coverage_case_id TEXT NOT NULL UNIQUE,
        starts_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (employee_id, starts_at, ends_at)
      )`);
    });
  }

  public reserve(input: ReservationInput): ReservationResult {
    const conflict = this.ctx.storage.sql
      .exec<{ coverage_case_id: string }>(
        `SELECT coverage_case_id FROM reservations
         WHERE employee_id = ? AND starts_at <= ? AND ? <= ends_at LIMIT 1`,
        input.employeeId,
        input.endsAt,
        input.startsAt,
      )
      .toArray()[0];
    if (conflict) return { reserved: false, conflictCoverageCaseId: conflict.coverage_case_id };
    this.ctx.storage.sql.exec(
      'INSERT INTO reservations (employee_id, coverage_case_id, starts_at, ends_at, created_at) VALUES (?, ?, ?, ?, ?)',
      input.employeeId,
      input.coverageCaseId,
      input.startsAt,
      input.endsAt,
      new Date().toISOString(),
    );
    return { reserved: true };
  }

  public release(coverageCaseId: string): void {
    this.ctx.storage.sql.exec('DELETE FROM reservations WHERE coverage_case_id = ?', coverageCaseId);
  }
}
