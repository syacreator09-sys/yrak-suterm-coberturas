#!/usr/bin/env node
const endpoints = {
  api: process.env.API_BASE_URL ?? 'http://127.0.0.1:8787',
  agents: process.env.AGENT_BASE_URL ?? 'http://127.0.0.1:8788',
  mcp: process.env.MCP_BASE_URL ?? 'http://127.0.0.1:8789',
};

const allowRemote = process.env.CONFIRM_REMOTE_STAGING_TEST === 'YES';
let failures = 0;
let warnings = 0;

function isLoopback(url) {
  const host = new URL(url).hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

for (const [name, url] of Object.entries(endpoints)) {
  if (!isLoopback(url) && !allowRemote) {
    console.error(`REFUSING_REMOTE_TEST: ${name}=${url}. Set CONFIRM_REMOTE_STAGING_TEST=YES only for an authorized staging environment.`);
    process.exit(2);
  }
}

async function check(label, url, options = {}, expected = [200]) {
  try {
    const response = await fetch(url, { redirect: 'manual', ...options });
    if (!expected.includes(response.status)) {
      console.error(`FAIL  ${label}: HTTP ${response.status}; expected ${expected.join('/')}`);
      failures += 1;
      return response;
    }
    console.log(`PASS  ${label}: HTTP ${response.status}`);
    return response;
  } catch (error) {
    console.error(`FAIL  ${label}: ${error instanceof Error ? error.message : String(error)}`);
    failures += 1;
    return undefined;
  }
}

console.log('== YRAK read-only connection smoke ==');
await check('API health', `${endpoints.api}/health`);
await check('API ready', `${endpoints.api}/ready`);
await check('Agent health', `${endpoints.agents}/health`);
await check('Agent ready', `${endpoints.agents}/ready`);
await check('MCP health', `${endpoints.mcp}/health`);
await check('MCP ready', `${endpoints.mcp}/ready`);

await check(
  'Agent rejects wrong bearer token',
  `${endpoints.agents}/v1/support/smoke-session/history`,
  { headers: { authorization: 'Bearer definitely-wrong' } },
  [401],
);
await check(
  'MCP rejects wrong bearer token',
  `${endpoints.mcp}/mcp`,
  { method: 'POST', headers: { authorization: 'Bearer definitely-wrong', 'content-type': 'application/json' }, body: '{}' },
  [401],
);

const devEmail = process.env.DEV_USER_EMAIL;
if (devEmail) {
  const response = await check(
    'API authenticated read-only /v1/me',
    `${endpoints.api}/v1/me`,
    { headers: { 'x-yrak-user-email': devEmail } },
    [200, 403],
  );
  if (response?.status === 403) {
    console.warn('WARN  DEV_USER_EMAIL is not provisioned in local D1 yet; bootstrap synthetic user before role/E2E tests.');
    warnings += 1;
  }
} else {
  console.warn('WARN  DEV_USER_EMAIL not set; authenticated /v1/me smoke skipped.');
  warnings += 1;
}

console.log(`\nSmoke result: ${failures} failure(s), ${warnings} warning(s).`);
if (failures) process.exit(1);
