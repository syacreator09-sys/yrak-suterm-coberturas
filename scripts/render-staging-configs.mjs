#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (process.env.CONFIRM_YRAK_STAGING !== 'YES') {
  console.error('REFUSING_STAGING_RENDER: set CONFIRM_YRAK_STAGING=YES after confirming these values belong to the authorized staging environment.');
  process.exit(2);
}

const required = [
  'YRAK_STAGING_D1_DATABASE_ID',
  'YRAK_STAGING_D1_DATABASE_NAME',
  'YRAK_STAGING_ORGANIZATION_ID',
  'YRAK_STAGING_ACCESS_TEAM_DOMAIN',
  'YRAK_STAGING_ACCESS_AUD',
  'YRAK_STAGING_EMAIL_FROM',
  'YRAK_STAGING_R2_BUCKET',
  'YRAK_STAGING_QUEUE',
  'YRAK_STAGING_WORKFLOW',
];
const values = Object.fromEntries(required.map((key) => [key, process.env[key]?.trim() ?? '']));
for (const [key, value] of Object.entries(values)) {
  if (!value || value.startsWith('REPLACE_')) {
    console.error(`MISSING_STAGING_VALUE: ${key}`);
    process.exit(2);
  }
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'));
}
function writeJson(relativePath, value) {
  const path = resolve(root, relativePath);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  console.log(`GENERATED ${relativePath}`);
}
function stagingName(base, overrideKey) {
  const override = process.env[overrideKey]?.trim();
  return override || `${base}-staging`;
}
function setD1(config) {
  if (!Array.isArray(config.d1_databases) || !config.d1_databases.length) throw new Error('D1_BINDING_MISSING');
  for (const binding of config.d1_databases) {
    binding.database_id = values.YRAK_STAGING_D1_DATABASE_ID;
    binding.database_name = values.YRAK_STAGING_D1_DATABASE_NAME;
  }
}

const api = readJson('apps/api-worker/wrangler.jsonc');
api.name = stagingName(api.name, 'YRAK_STAGING_API_WORKER_NAME');
api.vars = {
  ...api.vars,
  APP_ENV: 'staging',
  ACCESS_TEAM_DOMAIN: values.YRAK_STAGING_ACCESS_TEAM_DOMAIN,
  ACCESS_AUD: values.YRAK_STAGING_ACCESS_AUD,
  EMAIL_FROM: values.YRAK_STAGING_EMAIL_FROM,
  INBOUND_EMAIL_ORGANIZATION_ID: values.YRAK_STAGING_ORGANIZATION_ID,
};
setD1(api);
if (api.r2_buckets?.[0]) api.r2_buckets[0].bucket_name = values.YRAK_STAGING_R2_BUCKET;
for (const workflow of api.workflows ?? []) workflow.name = values.YRAK_STAGING_WORKFLOW;
for (const producer of api.queues?.producers ?? []) producer.queue = values.YRAK_STAGING_QUEUE;
for (const consumer of api.queues?.consumers ?? []) consumer.queue = values.YRAK_STAGING_QUEUE;
delete api.dev;
writeJson('apps/api-worker/wrangler.staging.local.jsonc', api);

const agents = readJson('apps/agent-worker/wrangler.jsonc');
agents.name = stagingName(agents.name, 'YRAK_STAGING_AGENT_WORKER_NAME');
agents.vars = { ...agents.vars, AGENT_ORGANIZATION_ID: values.YRAK_STAGING_ORGANIZATION_ID, AI_PROFILE: 'staging' };
setD1(agents);
delete agents.dev;
writeJson('apps/agent-worker/wrangler.staging.local.jsonc', agents);

const mcp = readJson('apps/mcp-worker/wrangler.jsonc');
mcp.name = stagingName(mcp.name, 'YRAK_STAGING_MCP_WORKER_NAME');
mcp.vars = { ...mcp.vars, MCP_ORGANIZATION_ID: values.YRAK_STAGING_ORGANIZATION_ID };
setD1(mcp);
delete mcp.dev;
writeJson('apps/mcp-worker/wrangler.staging.local.jsonc', mcp);

const maintenance = readJson('apps/maintenance-worker/wrangler.jsonc');
maintenance.name = stagingName(maintenance.name, 'YRAK_STAGING_MAINTENANCE_WORKER_NAME');
setD1(maintenance);
for (const producer of maintenance.queues?.producers ?? []) producer.queue = values.YRAK_STAGING_QUEUE;
delete maintenance.dev;
writeJson('apps/maintenance-worker/wrangler.staging.local.jsonc', maintenance);

console.log('PASS: isolated staging configs rendered. They contain non-secret staging identifiers only and are ignored by Git.');
console.log('NEXT: run node scripts/staging-preflight.mjs before any remote migration/deploy command.');
