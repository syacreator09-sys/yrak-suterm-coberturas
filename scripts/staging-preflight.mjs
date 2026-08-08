#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.env.CONFIRM_YRAK_STAGING !== 'YES') {
  console.error('REFUSING_STAGING_PREFLIGHT: set CONFIRM_YRAK_STAGING=YES only after confirming the intended staging environment.');
  process.exit(2);
}

const paths = {
  api: 'apps/api-worker/wrangler.staging.local.jsonc',
  agents: 'apps/agent-worker/wrangler.staging.local.jsonc',
  mcp: 'apps/mcp-worker/wrangler.staging.local.jsonc',
  maintenance: 'apps/maintenance-worker/wrangler.staging.local.jsonc',
};
const forbiddenSecretNames = [
  'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'AI_COMPAT_API_KEY', 'RAG_EMBEDDING_API_KEY',
  'SUPABASE_SECRET_KEY', 'UPSTASH_REDIS_REST_TOKEN', 'MODAL_API_TOKEN', 'HUGGINGFACE_TOKEN',
  'MCP_API_TOKEN', 'AGENT_API_TOKEN', 'BOOTSTRAP_TOKEN', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REFRESH_TOKEN',
];
let failures = 0;
function fail(message) { failures += 1; console.error(`FAIL  ${message}`); }
function pass(message) { console.log(`PASS  ${message}`); }
function load(label, relativePath) {
  const path = resolve(root, relativePath);
  if (!existsSync(path)) {
    fail(`${label}: missing ${relativePath}; run pnpm render:cloudflare-staging first`);
    return undefined;
  }
  const text = readFileSync(path, 'utf8');
  try { return { text, json: JSON.parse(text) }; }
  catch { fail(`${label}: invalid JSON in ${relativePath}`); return undefined; }
}

const loaded = Object.fromEntries(Object.entries(paths).map(([label, path]) => [label, load(label, path)]));
for (const [label, item] of Object.entries(loaded)) {
  if (!item) continue;
  const placeholders = [...new Set(item.text.match(/REPLACE_WITH_[A-Z0-9_]+/g) ?? [])];
  if (placeholders.length) fail(`${label}: unresolved placeholders ${placeholders.join(', ')}`);
  else pass(`${label}: no REPLACE_WITH_* placeholders`);

  const leakedNames = forbiddenSecretNames.filter((name) => item.text.includes(`"${name}"`) || item.text.includes(`${name}=`));
  if (leakedNames.length) fail(`${label}: secret-bearing variable names embedded in deploy config: ${leakedNames.join(', ')}`);
  else pass(`${label}: deploy config contains no secret-bearing variable names`);

  const name = String(item.json.name ?? '');
  if (!name.endsWith('-staging')) fail(`${label}: Worker name must end in -staging, found ${name || 'missing'}`);
  else pass(`${label}: isolated Worker name ${name}`);
  if ('dev' in item.json) fail(`${label}: generated staging config must not include a local dev block`);
}

const api = loaded.api?.json;
if (api) {
  if (api.vars?.APP_ENV === 'staging') pass('API APP_ENV=staging');
  else fail(`API APP_ENV must be staging, found ${api.vars?.APP_ENV ?? 'missing'}`);
  const teamDomain = String(api.vars?.ACCESS_TEAM_DOMAIN ?? '');
  if (/^[a-z0-9.-]+\.cloudflareaccess\.com$/i.test(teamDomain)) pass(`API Access team domain: ${teamDomain}`);
  else fail('API ACCESS_TEAM_DOMAIN is missing or not a *.cloudflareaccess.com host');
  if (api.vars?.ACCESS_AUD && !String(api.vars.ACCESS_AUD).startsWith('REPLACE_')) pass('API Access audience rendered');
  else fail('API Access audience missing');
  if (api.vars?.BOOTSTRAP_ENABLED === true || String(api.vars?.BOOTSTRAP_ENABLED ?? '').toLowerCase() === 'true') {
    fail('Generated staging config must not enable bootstrap by default');
  } else pass('Bootstrap disabled by default in staging config');
}

const agents = loaded.agents?.json;
if (agents) {
  if (agents.vars?.AI_PROFILE === 'staging') pass('Agents AI_PROFILE=staging');
  else fail(`Agents AI_PROFILE must be staging, found ${agents.vars?.AI_PROFILE ?? 'missing'}`);
}

const d1Entries = [];
for (const [label, item] of Object.entries(loaded)) {
  if (!item) continue;
  const binding = item.json.d1_databases?.[0];
  if (!binding?.database_id || !binding?.database_name) fail(`${label}: D1 binding incomplete`);
  else d1Entries.push({ label, id: binding.database_id, name: binding.database_name });
}
if (d1Entries.length === Object.keys(paths).length) {
  const ids = new Set(d1Entries.map((entry) => entry.id));
  const names = new Set(d1Entries.map((entry) => entry.name));
  if (ids.size === 1 && names.size === 1) pass(`All Workers share staging D1 ${d1Entries[0].name}`);
  else fail(`Workers do not share one staging D1: ${JSON.stringify(d1Entries)}`);
}

if (api && agents && loaded.mcp?.json) {
  const apiOrg = api.vars?.INBOUND_EMAIL_ORGANIZATION_ID;
  const agentOrg = agents.vars?.AGENT_ORGANIZATION_ID;
  const mcpOrg = loaded.mcp.json.vars?.MCP_ORGANIZATION_ID;
  if (apiOrg && apiOrg === agentOrg && apiOrg === mcpOrg) pass(`API/Agents/MCP share organization ${apiOrg}`);
  else fail('API/Agents/MCP organization IDs differ or are missing');
}

const apiQueue = api?.queues?.producers?.[0]?.queue;
const maintenanceQueue = loaded.maintenance?.json?.queues?.producers?.[0]?.queue;
if (apiQueue && maintenanceQueue && apiQueue === maintenanceQueue) pass(`API/Maintenance share queue ${apiQueue}`);
else if (api && loaded.maintenance) fail('API/Maintenance staging queue mismatch');

console.log(`\nStaging preflight: ${failures} failure(s).`);
if (failures) process.exit(1);
console.log('PASS  generated staging configs are internally consistent. This still does not authenticate Wrangler or prove resources exist.');
