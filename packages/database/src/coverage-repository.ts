import type {
  CoverageCase,
  CoverageCaseId,
  CoverageCaseStatus,
  GroupId,
  LevelId,
} from '@yrak/domain';
import { assertCoverageTransition, DomainError } from '@yrak/domain';
import type { D1DatabaseLike } from './client.js';
import { assertD1Success } from './client.js';

interface CoverageRow {
  id: string;
  group_id: string;
  vacant_level_id: string;
  starts_at: string;
  ends_at: string;
  duration_days: number;
  process_type: 'ROTATION' | 'COMPETITION';
  status: CoverageCaseStatus;
  version: number;
}

function mapCoverage(row: CoverageRow): CoverageCase {
  return {
    id: row.id as CoverageCaseId,
    groupId: row.group_id as GroupId,
    vacantLevelId: row.vacant_level_id as LevelId,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    durationDays: row.duration_days,
    processType: row.process_type,
    status: row.status,
    version: row.version,
  };
}

export class D1CoverageRepository {
  public constructor(private readonly db: D1DatabaseLike) {}

  public async getById(id: CoverageCaseId): Promise<CoverageCase | null> {
    const row = await this.db
      .prepare(
        'SELECT id, group_id, vacant_level_id, starts_at, ends_at, duration_days, process_type, status, version FROM coverage_cases WHERE id = ?',
      )
      .bind(id)
      .first<CoverageRow>();
    return row ? mapCoverage(row) : null;
  }

  public async transition(
    id: CoverageCaseId,
    expectedVersion: number,
    next: CoverageCaseStatus,
  ): Promise<CoverageCase> {
    const current = await this.getById(id);
    if (!current) throw new DomainError('COVERAGE_NOT_FOUND', 'No existe el expediente');
    assertCoverageTransition(current.status, next);
    const result = await this.db
      .prepare(
        "UPDATE coverage_cases SET status = ?, version = version + 1, updated_at = datetime('now') WHERE id = ? AND version = ?",
      )
      .bind(next, id, expectedVersion)
      .run();
    assertD1Success(result, 'transition coverage');
    const updated = await this.getById(id);
    if (!updated || updated.version !== expectedVersion + 1) {
      throw new DomainError(
        'OPTIMISTIC_LOCK_CONFLICT',
        'El expediente fue modificado por otro proceso',
      );
    }
    return updated;
  }
}
