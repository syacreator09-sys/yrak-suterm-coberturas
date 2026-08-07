import { DEFAULT_COVERAGE_POLICY, type CoveragePolicyConfig } from '@yrak/domain';
import type { AppEnv } from '../env.js';

export async function loadCoveragePolicy(env: AppEnv, organizationId: string, groupId: string, atDate: string): Promise<{ config: CoveragePolicyConfig; ruleVersionId: string }> {
  const row = await env.DB.prepare(`SELECT id, config_json FROM group_policies
    WHERE organization_id = ? AND (group_id = ? OR group_id IS NULL) AND policy_key = 'COVERAGE_POLICY'
      AND effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)
    ORDER BY CASE WHEN group_id = ? THEN 0 ELSE 1 END, version DESC LIMIT 1`)
    .bind(organizationId, groupId, atDate, atDate, groupId)
    .first<{ id:string; config_json:string }>();
  if (!row) return { config: DEFAULT_COVERAGE_POLICY, ruleVersionId: 'builtin-default-1' };
  return { config: { ...DEFAULT_COVERAGE_POLICY, ...JSON.parse(row.config_json) as Partial<CoveragePolicyConfig> }, ruleVersionId: row.id };
}
