#!/usr/bin/env node
const baseUrl = (process.env.API_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
let parsed;
try { parsed = new URL(baseUrl); } catch { console.error('INVALID_API_BASE_URL'); process.exit(2); }
const local = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
if (!local) {
  console.error('ROLE_MATRIX_LOCAL_ONLY: development identity headers are intentionally restricted to loopback. Use Access-authenticated staging E2E for remote role tests.');
  process.exit(2);
}

const identities = {
  admin: { email: process.env.DEV_ADMIN_EMAIL ?? 'admin@example.com', role: 'ADMIN' },
  hr: { email: 'hr@example.invalid', role: 'HR' },
  auditor: { email: 'auditor@example.invalid', role: 'AUDITOR' },
  supervisorA: { email: 'supervisor-a@example.invalid', role: 'SUPERVISOR' },
  supervisorB: { email: 'supervisor-b@example.invalid', role: 'SUPERVISOR' },
  committeeA: { email: 'committee-a@example.invalid', role: 'COMMITTEE' },
  operatorA: { email: 'operator-a@example.invalid', role: 'OPERATOR' },
  employeeA: { email: 'employee-a@example.invalid', role: 'EMPLOYEE' },
};

let failures = 0;
function pass(message) { console.log(`PASS  ${message}`); }
function fail(message) { failures += 1; console.error(`FAIL  ${message}`); }

async function call(identity, path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'x-yrak-user-email': identity.email,
      'x-correlation-id': `role-smoke-${crypto.randomUUID()}`,
      accept: 'application/json',
    },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, body };
}

for (const [name, identity] of Object.entries(identities)) {
  const me = await call(identity, '/v1/me');
  if (me.status !== 200) fail(`${name}: /v1/me expected 200, got ${me.status}`);
  else if (me.body?.user?.role !== identity.role) fail(`${name}: expected role ${identity.role}, got ${me.body?.user?.role ?? 'missing'}`);
  else pass(`${name}: authenticated as ${identity.role}`);
}

async function groupNames(identity) {
  const response = await call(identity, '/v1/reference/groups');
  return { ...response, names: Array.isArray(response.body?.items) ? response.body.items.map((row) => row.name).sort() : [] };
}

for (const name of ['admin', 'hr', 'auditor']) {
  const result = await groupNames(identities[name]);
  if (result.status !== 200) fail(`${name}: groups expected 200, got ${result.status}`);
  else if (!result.names.includes('YRAK TEST GROUP A') || !result.names.includes('YRAK TEST GROUP B')) fail(`${name}: organization-wide role does not see both synthetic groups`);
  else pass(`${name}: sees both synthetic groups`);
}

for (const [name, expected, forbidden] of [
  ['supervisorA', 'YRAK TEST GROUP A', 'YRAK TEST GROUP B'],
  ['supervisorB', 'YRAK TEST GROUP B', 'YRAK TEST GROUP A'],
  ['committeeA', 'YRAK TEST GROUP A', 'YRAK TEST GROUP B'],
  ['operatorA', 'YRAK TEST GROUP A', 'YRAK TEST GROUP B'],
]) {
  const result = await groupNames(identities[name]);
  if (result.status !== 200) fail(`${name}: groups expected 200, got ${result.status}`);
  else if (!result.names.includes(expected) || result.names.includes(forbidden)) fail(`${name}: A/B group isolation failed (${JSON.stringify(result.names)})`);
  else pass(`${name}: group scope isolated to ${expected}`);
}

const employeeGroups = await groupNames(identities.employeeA);
if (employeeGroups.status !== 403) fail(`employeeA: reference groups expected 403, got ${employeeGroups.status}`);
else pass('employeeA: admin reference endpoint denied');

for (const name of ['supervisorA', 'committeeA']) {
  const result = await call(identities[name], '/v1/employees');
  if (result.status !== 200) {
    fail(`${name}: employees expected 200, got ${result.status}`);
    continue;
  }
  const items = Array.isArray(result.body?.items) ? result.body.items : [];
  if (!items.some((row) => row.employee_number === 'TEST-A-001')) fail(`${name}: scoped employee A not visible`);
  else if (items.some((row) => row.employee_number === 'TEST-B-001')) fail(`${name}: cross-group employee B leaked`);
  else if (items.some((row) => row.email !== null && row.email !== undefined)) fail(`${name}: employee email leaked to scoped operational role`);
  else pass(`${name}: employee list scoped and email minimized`);
}

const operatorEmployees = await call(identities.operatorA, '/v1/employees');
if (operatorEmployees.status !== 403) fail(`operatorA: employees expected 403, got ${operatorEmployees.status}`);
else pass('operatorA: employee directory denied');

const employeeDirectory = await call(identities.employeeA, '/v1/employees');
if (employeeDirectory.status !== 403) fail(`employeeA: employees expected 403, got ${employeeDirectory.status}`);
else pass('employeeA: employee directory denied');

if (failures) {
  console.error(`\nRole matrix failed with ${failures} issue(s).`);
  process.exit(1);
}
console.log('\nPASS  seven-role local matrix + A/B isolation + scoped email minimization.');
