import { describe, expect, it } from 'vitest';
import { buildOverviewMetrics } from './overview-model.js';

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
