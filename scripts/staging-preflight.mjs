#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configs = [
  ['API', 'apps/api-worker/wrangler.staging.local.jsonc'],
  ['Agents', 'apps/agent-worker/wrangler.staging.local.jsonc'],
  ['MCP', 'apps/mcp-worker/wrangler.staging.local.jsonc'],
  ['Maintenance', 'apps/maintenance-worker/wrangler.staging.local.jsonc'],
];
const forbiddenSecretNames = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'AI_COMPAT_API_KEY',
  'RAG_EMBEDDING_API_KEY',
  'SUPABASE_SECRET_KEY',
  'UPSTASH_REDIS_REST_TOKEN',
  'MODAL_API_TOKEN',
  'HUGGINGFACE_TOKEN',
  'MCP_API_TOKEN',
  'AGENT_API_TOKEN',
  'BOOTSTRAP_TOKEN',
];
let failures = 0;
function fail(message) { failures += 1; console.error(`FAIL  ${message}`); }
function pass(message) { console.log(`PASS  ${message}`); }

for (const [label, relative] of configs) {
  const path = resolve(root, relative);
  if (!existsSync(path)) {
    fail(`${label}: missing ${relative}; run pnpm render:cloudflare-staging first`);
    continue;
  }
  const text = readFileSync(path, 'utf8');
  const placeholders = [...new Set(text.match(/REPLACE_WITH_[A-Z0-9_]+/g) ?? [])];
  if (placeholders.length) fail(`${label}: unresolved placeholders ${placeholders.join(', ')}`);
  else pass(`${label}: no REPLACE_WITH_* placeholders`);

  const leakedNames = forbiddenSecretNames.filter((name) => text.includes(`"${name}"`) || text.includes(`${name}=`));
  if (leakedNames.length) fail(`${label}: secret-bearing variable names embedded in generated deploy config: ${leakedNames.join(', ')}`);
  else pass(`${label}: deploy config contains no secret-bearing variable names`);
}

const apiPath = resolve(root, configs[0][1]);
if (existsSync(apiPath)) {
  const api = readFileSync(apiPath, 'utf8');
  if (/"APP_ENV"\s*:\s*"staging"/.test(api)) pass('API APP_ENV=staging');
  else fail('API generated config is not APP_ENV=staging');
  if (/"ACCESS_TEAM_DOMAIN"\s*:\s*"[^R][^"]*\.cloudflareaccess\.com"/.test(api)) pass('API Access team domain rendered');
  else fail('API Access team domain is missing/invalid');
  if (/"ACCESS_AUD"\s*:\s*"(?!REPLACE_)[^"]+"/.test(api)) pass('API Access audience rendered');
  else fail('API Access audience is missing');
}

const agentsPath = resolve(root, configs[1][1]);
if (existsSync(agentsPath)) {
  const agents = readFileSync(agentsPath, 'utf8');
  if (/"AI_PROFILE"\s*:\s*"staging"/.test(agents)) pass('Agents AI_PROFILE=staging');
  else fail('Agents generated config is not AI_PROFILE=staging');
}

if (failures) process.exit(1);
console.log('\nPASS  staging config preflight. This does not authenticate Wrangler or prove remote resources exist.');
