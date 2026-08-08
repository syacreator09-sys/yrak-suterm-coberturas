#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiBase = (process.env.API_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const url = new URL(apiBase);
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname.toLowerCase())) {
  console.error('REFUSING_REMOTE_SEED: seed-local.mjs is local-only.');
  process.exit(2);
}

const adminEmail = process.env.DEV_USER_EMAIL ?? 'admin@example.com';
const bootstrapToken = process.env.BOOTSTRAP_TOKEN ?? 'local-change-me';
const organizationName = process.env.LOCAL_ORGANIZATION_NAME ?? 'YRAK Local Test';

async function resolveOrganizationId() {
  const response = await fetch(`${apiBase}/bootstrap`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-yrak-bootstrap-token': bootstrapToken,
    },
    body: JSON.stringify({
      organizationName,
      timezone: 'America/Mexico_City',
      adminEmail,
      adminDisplayName: 'YRAK Local Admin',
    }),
  });

  if (response.status === 201) {
    const body = await response.json();
    console.log(`PASS  local organization created: ${body.organizationId}`);
    return body.organizationId;
  }
  if (response.status !== 409) {
    console.error(`FAIL  bootstrap returned HTTP ${response.status}: ${await response.text()}`);
    process.exit(1);
  }

  const me = await fetch(`${apiBase}/v1/me`, { headers: { 'x-yrak-user-email': adminEmail } });
  if (!me.ok) {
    console.error(`FAIL  bootstrap already exists but /v1/me returned HTTP ${me.status}`);
    process.exit(1);
  }
  const body = await me.json();
  const organizationId = body?.user?.organizationId;
  if (!organizationId) {
    console.error('FAIL  /v1/me did not return user.organizationId');
    process.exit(1);
  }
  console.log(`PASS  existing local organization resolved: ${organizationId}`);
  return organizationId;
}

function setKey(relativePath, key, value) {
  const path = resolve(root, relativePath);
  if (!existsSync(path)) {
    console.error(`FAIL  ${relativePath} missing. Run bash scripts/bootstrap-local.sh first.`);
    process.exit(1);
  }
  const current = readFileSync(path, 'utf8');
  const expression = new RegExp(`^${key}=.*$`, 'm');
  const next = expression.test(current) ? current.replace(expression, `${key}=${value}`) : `${current.trimEnd()}\n${key}=${value}\n`;
  writeFileSync(path, next, { encoding: 'utf8', mode: 0o600 });
  console.log(`PASS  ${key} synchronized in ignored ${relativePath}`);
}

const organizationId = await resolveOrganizationId();
setKey('apps/agent-worker/.dev.vars', 'AGENT_ORGANIZATION_ID', organizationId);
setKey('apps/mcp-worker/.dev.vars', 'MCP_ORGANIZATION_ID', organizationId);

console.log('\nLocal synthetic seed ready. Restart Agent/MCP dev processes if they were already running.');
