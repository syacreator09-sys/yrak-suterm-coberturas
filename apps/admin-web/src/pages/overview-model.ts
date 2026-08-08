export interface CoverageSummaryRow {
  status?: string;
  process_type?: string;
}

export interface OverviewMetrics {
  employees: number | null;
  groups: number | null;
  coverages: number | null;
  activeOrScheduled: number | null;
  competitions: number | null;
}

export function buildOverviewMetrics(input: {
  employees?: readonly unknown[] | undefined;
  groups?: readonly unknown[] | undefined;
  coverages?: readonly CoverageSummaryRow[] | undefined;
}): OverviewMetrics {
  const coverages = input.coverages;
  return {
    employees: input.employees ? input.employees.length : null,
    groups: input.groups ? input.groups.length : null,
    coverages: coverages ? coverages.length : null,
    activeOrScheduled: coverages ? coverages.filter((row) => ['ACTIVE', 'SCHEDULED'].includes(String(row.status ?? ''))).length : null,
    competitions: coverages ? coverages.filter((row) => String(row.process_type ?? '').toUpperCase() === 'COMPETITION').length : null,
  };
}
