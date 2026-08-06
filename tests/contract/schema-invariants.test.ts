import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function migration(name: string): string {
  return readFileSync(new URL(`../../migrations/${name}`, import.meta.url), 'utf8');
}

describe('database invariants', () => {
  it('enforces the 1–5 versus 6+ process boundary in SQL', () => {
    const sql = migration('0003_coverages.sql');
    expect(sql).toContain("duration_days <= 5 AND process_type = 'ROTATION'");
    expect(sql).toContain("duration_days >= 6 AND process_type = 'COMPETITION'");
  });

  it('makes audit events append-only', () => {
    const sql = migration('0006_audit_and_messages.sql');
    expect(sql).toContain('audit_events_no_update');
    expect(sql).toContain('audit_events_no_delete');
  });

  it('makes score revisions and their approvals append-only', () => {
    expect(migration('0007_policy_and_score_revisions.sql')).toContain(
      'competition_score_revisions_no_update',
    );
    const approvals = migration('0008_score_revision_approvals.sql');
    expect(approvals).toContain('competition_score_revision_approvals_no_update');
    expect(approvals).toContain('competition_score_revision_approvals_no_delete');
  });
});
