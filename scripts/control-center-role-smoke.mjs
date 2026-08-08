#!/usr/bin/env node

const baseUrl = (process.env.API_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const parsedBase = new URL(baseUrl);
const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
if (!localHosts.has(parsedBase.hostname) && process.env.ALLOW_REMOTE_ROLE_SMOKE !== '1') {
  console.error('REFUSING_REMOTE_ROLE_SMOKE: set ALLOW_REMOTE_ROLE_SMOKE=1 only for an explicitly authorized staging environment.');
  process.exit(2);
}

const roles = [
  ['ADMIN', 'YRAK_ADMIN_EMAIL'],
  ['HR', 'YRAK_HR_EMAIL'],
  ['SUPERVISOR', 'YRAK_SUPERVISOR_EMAIL'],
  ['COMMITTEE', 'YRAK_COMMITTEE_EMAIL'],
  ['OPERATOR', 'YRAK_OPERATOR_EMAIL'],
  ['AUDITOR', 'YRAK_AUDITOR_EMAIL'],
  ['EMPLOYEE', 'YRAK_EMPLOYEE_EMAIL'],
];

const expected = {
  ADMIN: [
    ['/v1/me', 200], ['/v1/reference/groups', 200], ['/v1/employees', 200], ['/v1/coverage-cases', 200],
    ['/v1/system/health', 200], ['/v1/config/groups', 200],
  ],
  HR: [
    ['/v1/me', 200], ['/v1/reference/groups', 200], ['/v1/employees', 200], ['/v1/coverage-cases', 200],
    ['/v1/system/health', 200], ['/v1/config/groups', 200],
  ],
  SUPERVISOR: [
    ['/v1/me', 200], ['/v1/reference/groups', 200], ['/v1/employees', 200], ['/v1/coverage-cases', 200],
    ['/v1/system/health', 403], ['/v1/config/groups', 403],
  ],
  COMMITTEE: [
    ['/v1/me', 200], ['/v1/reference/groups', 200], ['/v1/employees', 200], ['/v1/coverage-cases', 200],
    ['/v1/system/health', 403], ['/v1/config/groups', 403],
  ],
  OPERATOR: [
    ['/v1/me', 200], ['/v1/reference/groups', 200], ['/v1/employees', 403], ['/v1/coverage-cases', 200],
    ['/v1/system/health', 403], ['/v1/config/groups', 403],
  ],
  AUDITOR: [
    ['/v1/me', 200], ['/v1/reference/groups', 200], ['/v1/employees', 200], ['/v1/coverage-cases', 200],
    ['/v1/system/health', 200], ['/v1/config/groups', 403],
  ],
  EMPLOYEE: [
    ['/v1/me', 200], ['/v1/reference/groups', 403], ['/v1/employees', 403], ['/v1/coverage-cases', 403],
    ['/v1/system/health', 403], ['/v1/config/groups', 403],
  ],
};

async function request(email, path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'x-yrak-user-email': email,
      'x-correlation-id': `role-smoke-${crypto.randomUUID()}`,
    },
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = await response.text().catch(() => null);
  }
  return { status: response.status, body };
}

let failures = 0;
let executed = 0;
for (const [role, envName] of roles) {
  const email = process.env[envName];
  if (!email) {
    console.log(`SKIP ${role}: ${envName} not configured`);
    continue;
  }

  const me = await request(email, '/v1/me');
  if (me.status !== 200 || me.body?.user?.role !== role) {
    failures += 1;
    console.error(`FAIL ${role} /v1/me: expected role ${role}, got status=${me.status} role=${me.body?.user?.role ?? 'n/a'}`);
    continue;
  }

  for (const [path, expectedStatus] of expected[role]) {
    executed += 1;
    const result = await request(email, path);
    if (result.status !== expectedStatus) {
      failures += 1;
      console.error(`FAIL ${role} ${path}: expected ${expectedStatus}, got ${result.status}`);
    } else {
      console.log(`PASS ${role} ${path} -> ${result.status}`);
    }
  }
}

if (!executed) {
  console.error('NO_ROLE_TESTS_EXECUTED: configure at least one YRAK_*_EMAIL variable.');
  process.exit(2);
}
if (failures) {
  console.error(`ROLE_SMOKE_FAILED: ${failures} checks failed.`);
  process.exit(1);
}
console.log(`ROLE_SMOKE_PASS: ${executed} read-only authorization checks passed.`);
