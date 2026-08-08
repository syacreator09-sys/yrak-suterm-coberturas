export interface CoverageSummaryRow {
  id?: string;
  status?: string;
  process_type?: string;
  target_level_id?: string;
  starts_on?: string;
  ends_on?: string;
  effective_days?: number;
  created_at?: string;
  updated_at?: string;
}

export interface OverviewMetrics {
  employees: number | null;
  groups: number | null;
  coverages: number | null;
  activeOrScheduled: number | null;
  competitions: number | null;
}

export interface CoverageDistribution {
  active: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  other: number;
  total: number;
}

export interface RecentCoverageActivity {
  id: string;
  status: string;
  timestamp: string;
  processType: string;
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

export function buildCoverageDistribution(coverages: readonly CoverageSummaryRow[]): CoverageDistribution {
  const result: CoverageDistribution = { active: 0, upcoming: 0, completed: 0, cancelled: 0, other: 0, total: coverages.length };
  for (const row of coverages) {
    const status = String(row.status ?? '').toUpperCase();
    if (status === 'ACTIVE') result.active += 1;
    else if (status === 'SCHEDULED') result.upcoming += 1;
    else if (status === 'COMPLETED') result.completed += 1;
    else if (status === 'CANCELLED') result.cancelled += 1;
    else result.other += 1;
  }
  return result;
}

function isoDateOnly(value: string): string {
  return value.slice(0, 10);
}

export function buildUpcomingCoverages(
  coverages: readonly CoverageSummaryRow[],
  todayIso = new Date().toISOString().slice(0, 10),
  horizonDays = 7,
): CoverageSummaryRow[] {
  const start = new Date(`${todayIso}T00:00:00Z`).getTime();
  const end = start + horizonDays * 86_400_000;
  return coverages
    .filter((row) => {
      const status = String(row.status ?? '').toUpperCase();
      if (['COMPLETED', 'CANCELLED'].includes(status) || !row.starts_on) return false;
      const timestamp = new Date(`${isoDateOnly(row.starts_on)}T00:00:00Z`).getTime();
      return Number.isFinite(timestamp) && timestamp >= start && timestamp <= end;
    })
    .sort((a, b) => String(a.starts_on ?? '').localeCompare(String(b.starts_on ?? '')))
    .slice(0, 6);
}

export function buildRecentCoverageActivity(coverages: readonly CoverageSummaryRow[]): RecentCoverageActivity[] {
  return coverages
    .map((row) => ({
      id: String(row.id ?? ''),
      status: String(row.status ?? 'UNKNOWN'),
      timestamp: String(row.updated_at ?? row.created_at ?? ''),
      processType: String(row.process_type ?? 'UNKNOWN'),
    }))
    .filter((row) => row.id && row.timestamp)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 6);
}
