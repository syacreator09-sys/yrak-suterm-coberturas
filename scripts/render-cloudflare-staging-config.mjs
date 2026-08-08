#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`MISSING_REQUIRED_ENV: ${name}`);
    process.exit(2);
  }
  return value;
}

const values = {
  d1: required('CLOUDFLARE_D1_DATABASE_ID'),
  organizationId: required('YRAK_ORGANIZATION_ID'),
  accessTeamDomain: required('ACCESS_TEAM_DOMAIN'),
  accessAudience: required('ACCESS_AUD'),
  emailFrom: process.env.EMAIL_FROM?.trim() || 'REPLACE_WITH_VERIFIED_SENDER',
};

if (!/^[0-9a-f-]{20,}$/i.test(values.d1)) {
  console.error('CLOUDFLARE_D1_DATABASE_ID does not look like a D1 resource id.');
  process.exit(2);
}
if (!values.accessTeamDomain.endsWith('.cloudflareaccess.com')) {
  console.error('ACCESS_TEAM_DOMAIN must be the Cloudflare Access team domain (*.cloudflareaccess.com).');
  process.exit(2);
}
if (values.organizationId.startsWith('REPLACE_')) {
  console.error('YRAK_ORGANIZATION_ID must be a real staging organization id.');
  process.exit(2);
}

const targets = [
  ['apps/api-worker/wrangler.jsonc', 'apps/api-worker/wrangler.staging.local.jsonc'],
  ['apps/agent-worker/wrangler.jsonc', 'apps/agent-worker/wrangler.staging.local.jsonc'],
  ['apps/mcp-worker/wrangler.jsonc', 'apps/mcp-worker/wrangler.staging.local.jsonc'],
  ['apps/maintenance-worker/wrangler.jsonc', 'apps/maintenance-worker/wrangler.staging.local.jsonc'],
];

function replaceAll(source) {
  let text = source
    .replaceAll('REPLACE_WITH_D1_DATABASE_ID', values.d1)
    .replaceAll('REPLACE_WITH_ORGANIZATION_ID', values.organizationId)
    .replaceAll('REPLACE_WITH_ACCESS_TEAM_DOMAIN', values.accessTeamDomain)
    .replaceAll('REPLACE_WITH_ACCESS_AUD', values.accessAudience)
    .replaceAll('REPLACE_WITH_VERIFIED_SENDER', values.emailFrom);

  text = text.replace(/"APP_ENV"\s*:\s*"development"/g, '"APP_ENV":"staging"');
  text = text.replace(/"AI_PROFILE"\s*:\s*"production"/g, '"AI_PROFILE":"staging"');
  return text;
}

for (const [sourceRelative, outputRelative] of targets) {
  const sourcePath = resolve(root, sourceRelative);
  const outputPath = resolve(root, outputRelative);
  const rendered = replaceAll(readFileSync(sourcePath, 'utf8'));
  const unresolved = [...rendered.matchAll(/REPLACE_WITH_[A-Z0-9_]+/g)].map((match) => match[0]);
  if (unresolved.length) {
    const unique = [...new Set(unresolved)];
    console.error(`UNRESOLVED_PLACEHOLDERS in ${sourceRelative}: ${unique.join(', ')}`);
    process.exit(1);
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, rendered, { encoding: 'utf8', mode: 0o600 });
  console.log(`GENERATED ${outputRelative}`);
}

console.log('\nGenerated ignored staging config files. Review them before any deploy.');
console.log('Do not add API tokens/provider keys to these files; use Cloudflare secret storage.');
