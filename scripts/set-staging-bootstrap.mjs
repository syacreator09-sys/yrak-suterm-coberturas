#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const action = process.argv[2];
if (!['enable', 'disable'].includes(action)) {
  console.error('USAGE: node scripts/set-staging-bootstrap.mjs enable|disable');
  process.exit(2);
}
if (process.env.CONFIRM_YRAK_STAGING !== 'YES') {
  console.error('REFUSING_STAGING_CHANGE: set CONFIRM_YRAK_STAGING=YES for the authorized staging environment.');
  process.exit(2);
}
if (action === 'enable' && process.env.CONFIRM_STAGING_BOOTSTRAP !== 'YES') {
  console.error('REFUSING_BOOTSTRAP_ENABLE: set CONFIRM_STAGING_BOOTSTRAP=YES only for the initial empty staging database.');
  process.exit(2);
}

const relative = 'apps/api-worker/wrangler.staging.local.jsonc';
const path = resolve(root, relative);
if (!existsSync(path)) {
  console.error(`STAGING_CONFIG_MISSING: ${relative}. Run pnpm render:cloudflare-staging first.`);
  process.exit(2);
}
const config = JSON.parse(readFileSync(path, 'utf8'));
if (config.vars?.APP_ENV !== 'staging' || !String(config.name ?? '').endsWith('-staging')) {
  console.error('REFUSING_NON_STAGING_CONFIG: generated API config does not identify an isolated staging Worker.');
  process.exit(2);
}
config.vars ??= {};
if (action === 'enable') config.vars.BOOTSTRAP_ENABLED = 'true';
else delete config.vars.BOOTSTRAP_ENABLED;
writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
console.log(`${action === 'enable' ? 'ENABLED' : 'DISABLED'} staging bootstrap in ignored local deploy config.`);
if (action === 'enable') {
  console.log('NEXT: set BOOTSTRAP_TOKEN as a staging Worker secret, run preflight with ALLOW_STAGING_BOOTSTRAP=YES, deploy/bootstrap once, then disable and redeploy immediately.');
} else {
  console.log('PASS: staging bootstrap removed from generated config. Redeploy API and delete BOOTSTRAP_TOKEN secret if no longer needed.');
}
