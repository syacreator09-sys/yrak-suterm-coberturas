#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}
function pass(message) { console.log(`PASS  ${message}`); }
function fail(message) { failures += 1; console.error(`FAIL  ${message}`); }

const mcp = read('apps/mcp-worker/src/index.ts');
const mcpMutations = [...mcp.matchAll(/\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|REPLACE\s+INTO)\s+([a-zA-Z0-9_]+)/gi)]
  .map((match) => ({ verb: match[1].toUpperCase(), table: match[2].toLowerCase() }));
const forbiddenMcpMutations = mcpMutations.filter(({ verb, table }) => !(verb === 'INSERT INTO' && table === 'mcp_access_log'));
if (forbiddenMcpMutations.length) {
  fail(`MCP contains business-data mutation SQL: ${forbiddenMcpMutations.map((item) => `${item.verb} ${item.table}`).join(', ')}`);
} else {
  pass('MCP has no business-data mutation SQL; only append-only mcp_access_log writes are allowed');
}

const agent = `${read('apps/agent-worker/src/index.ts')}\n${read('apps/agent-worker/src/session.ts')}`;
const laborTables = [
  'coverage_cases',
  'temporary_assignments',
  'rotation_queue_entries',
  'rotation_pools',
  'competition_candidates',
  'competitions',
  'employee_requirements',
  'employees',
  'users',
  'group_policies',
  'level_transitions',
];
const laborMutationPattern = new RegExp(`\\b(?:INSERT\\s+INTO|UPDATE|DELETE\\s+FROM|REPLACE\\s+INTO)\\s+(?:${laborTables.join('|')})\\b`, 'i');
if (laborMutationPattern.test(agent)) fail('Agent Worker contains direct labor/domain table mutation SQL');
else pass('Agent Worker does not directly mutate labor/domain tables');

const apiIndex = read('apps/api-worker/src/index.ts');
const apiWrangler = read('apps/api-worker/wrangler.jsonc');
if (/\basync\s+scheduled\s*\(/.test(apiIndex) || /"triggers"\s*:/.test(apiWrangler)) {
  fail('API Worker owns a scheduled cron; Maintenance must be the sole scheduled maintenance owner');
} else {
  pass('API Worker has no scheduled maintenance ownership');
}

const maintenanceIndex = read('apps/maintenance-worker/src/index.ts');
const maintenanceWrangler = read('apps/maintenance-worker/wrangler.jsonc');
if (!/\basync\s+scheduled\s*\(/.test(maintenanceIndex) || !/"triggers"\s*:/.test(maintenanceWrangler)) {
  fail('Maintenance Worker is missing scheduled handler or cron configuration');
} else {
  pass('Maintenance Worker is the configured scheduled maintenance owner');
}

for (const path of ['.claude/agents/yrak-auditor.md', '.claude/agents/yrak-code-reviewer.md']) {
  const source = read(path);
  const frontmatter = source.split('---')[1] ?? '';
  if (/\bBash\b/.test(frontmatter) || /\bEdit\b/.test(frontmatter) || /\bWrite\b/.test(frontmatter)) {
    fail(`${path} exposes mutation-capable tools despite read-only role`);
  } else {
    pass(`${path} tool surface remains read-only`);
  }
}

if (failures) process.exit(1);
console.log('PASS  architecture boundary checks completed');
