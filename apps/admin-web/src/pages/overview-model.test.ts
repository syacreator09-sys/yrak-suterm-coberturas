import { describe, expect, it } from 'vitest';
import {
  buildCoverageDistribution,
  buildOverviewMetrics,
  buildRecentCoverageActivity,
  buildUpcomingCoverages,
} from './overview-model.js';

describe('buildOverviewMetrics', () => {
  it('aggregates operational KPIs from synthetic data', () => {
    expect(buildOverviewMetrics({
      employees: [{}, {}],
      groups: [{}],
      coverages: [
        { status: 'ACTIVE', process_type: 'ROTATION' },
        { status: 'SCHEDULED', process_type: 'COMPETITION' },
        { status: 'COMPLETED', process_type: 'COMPETITION' },
      ],
    })).toEqual({ employees: 2, groups: 1, coverages: 3, activeOrScheduled: 2, competitions: 2 });
  });

  it('uses null when a data source could not be loaded', () => {
    expect(buildOverviewMetrics({ coverages: [] })).toEqual({
      employees: null,
      groups: null,
      coverages: 0,
      activeOrScheduled: 0,
      competitions: 0,
    });
  });
});

describe('buildCoverageDistribution', () => {
  it('groups visible coverages into dashboard status buckets', () => {
    expect(buildCoverageDistribution([
      { status: 'ACTIVE' },
      { status: 'ACTIVE' },
      { status: 'SCHEDULED' },
      { status: 'COMPLETED' },
      { status: 'CANCELLED' },
      { status: 'PENDING_APPROVAL' },
    ])).toEqual({
      active: 2,
      upcoming: 1,
      completed: 1,
      cancelled: 1,
      other: 1,
      total: 6,
    });
  });
});

describe('buildUpcomingCoverages', () => {
  it('returns only non-terminal upcoming rows sorted by start date', () => {
    const rows = buildUpcomingCoverages([
      { id: 'late', status: 'SCHEDULED', starts_on: '2026-08-11', ends_on: '2026-08-12' },
      { id: 'done', status: 'COMPLETED', starts_on: '2026-08-08', ends_on: '2026-08-09' },
      { id: 'first', status: 'ACTIVE', starts_on: '2026-08-09', ends_on: '2026-08-10' },
      { id: 'second', status: 'PENDING_APPROVAL', starts_on: '2026-08-10', ends_on: '2026-08-11' },
    ], '2026-08-08', 7);

    expect(rows.map((row) => row.id)).toEqual(['first', 'second', 'late']);
  });
});

describe('buildRecentCoverageActivity', () => {
  it('uses visible coverage timestamps and never invents actors', () => {
    const rows = buildRecentCoverageActivity([
      { id: 'a', status: 'ACTIVE', updated_at: '2026-08-07T10:00:00Z', process_type: 'ROTATION' },
      { id: 'b', status: 'SCHEDULED', created_at: '2026-08-07T11:00:00Z', process_type: 'COMPETITION' },
    ]);

    expect(rows).toEqual([
      { id: 'b', status: 'SCHEDULED', timestamp: '2026-08-07T11:00:00Z', processType: 'COMPETITION' },
      { id: 'a', status: 'ACTIVE', timestamp: '2026-08-07T10:00:00Z', processType: 'ROTATION' },
    ]);
  });
});
