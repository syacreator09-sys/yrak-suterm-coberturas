#!/usr/bin/env node
const baseUrl = (process.env.API_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const adminEmail = process.env.DEV_ADMIN_EMAIL ?? 'admin@example.com';

let parsed;
try { parsed = new URL(baseUrl); } catch { console.error('INVALID_API_BASE_URL'); process.exit(2); }
if (!['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
  console.error('REFUSING_REMOTE_AUTH_FIXTURE: this script may mutate synthetic fixtures only on loopback.');
  process.exit(2);
}
if (process.env.CONFIRM_LOCAL_AUTH_FIXTURE !== 'YES') {
  console.error('REFUSING_MUTATION: set CONFIRM_LOCAL_AUTH_FIXTURE=YES for the isolated local D1 fixture.');
  process.exit(2);
}

function headers(email = adminEmail) {
  return { 'content-type': 'application/json', 'x-yrak-user-email': email, 'x-correlation-id': `fixture-${crypto.randomUUID()}` };
}
async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...headers(), ...(options.headers ?? {}) } });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) {
    console.error(`FIXTURE_REQUEST_FAILED ${options.method ?? 'GET'} ${path} HTTP ${response.status}`);
    if (body?.error) console.error(`CODE ${body.error}`);
    process.exit(1);
  }
  return body;
}

async function ensureGroup(name) {
  const listed = await request('/v1/config/groups');
  const existing = listed.items?.find((row) => row.name === name);
  if (existing) return existing;
  return request('/v1/config/groups', { method: 'POST', body: JSON.stringify({ name, description: 'Synthetic authorization fixture' }) });
}
async function ensureLevel(groupId, number, name) {
  const listed = await request(`/v1/config/groups/${encodeURIComponent(groupId)}/levels`);
  const existing = listed.items?.find((row) => row.level_number === number);
  if (existing) return existing;
  return request(`/v1/config/groups/${encodeURIComponent(groupId)}/levels`, {
    method: 'POST',
    body: JSON.stringify({ number, name, rankOrder: number }),
  });
}
async function ensureEmployee({ employeeNumber, name, email, groupId, baseLevelId }) {
  const listed = await request('/v1/employees');
  const existing = listed.items?.find((row) => row.employee_number === employeeNumber);
  if (existing) return existing;
  return request('/v1/employees', {
    method: 'POST',
    body: JSON.stringify({ employeeNumber, name, email, groupId, baseLevelId, seniorityDate: '2020-01-01' }),
  });
}
async function ensureUser({ email, displayName, role, groupIds = [], employeeId = null }) {
  const listed = await request('/v1/config/users');
  const existing = listed.items?.find((row) => String(row.email).toLowerCase() === email.toLowerCase());
  if (existing) {
    if (existing.role !== role) {
      console.error(`FIXTURE_ROLE_MISMATCH ${email}: expected ${role}, found ${existing.role}`);
      process.exit(1);
    }
    return existing;
  }
  return request('/v1/config/users', {
    method: 'POST',
    body: JSON.stringify({ email, displayName, role, employeeId, groupIds }),
  });
}

const groupA = await ensureGroup('YRAK TEST GROUP A');
const groupB = await ensureGroup('YRAK TEST GROUP B');
const levelA = await ensureLevel(groupA.id, 101, 'Synthetic Level A');
const levelB = await ensureLevel(groupB.id, 102, 'Synthetic Level B');
const employeeA = await ensureEmployee({ employeeNumber: 'TEST-A-001', name: 'Synthetic Employee A', email: 'employee-a@example.invalid', groupId: groupA.id, baseLevelId: levelA.id });
const employeeB = await ensureEmployee({ employeeNumber: 'TEST-B-001', name: 'Synthetic Employee B', email: 'employee-b@example.invalid', groupId: groupB.id, baseLevelId: levelB.id });

await ensureUser({ email: 'hr@example.invalid', displayName: 'Synthetic HR', role: 'HR', groupIds: [] });
await ensureUser({ email: 'auditor@example.invalid', displayName: 'Synthetic Auditor', role: 'AUDITOR', groupIds: [] });
await ensureUser({ email: 'supervisor-a@example.invalid', displayName: 'Synthetic Supervisor A', role: 'SUPERVISOR', groupIds: [groupA.id] });
await ensureUser({ email: 'supervisor-b@example.invalid', displayName: 'Synthetic Supervisor B', role: 'SUPERVISOR', groupIds: [groupB.id] });
await ensureUser({ email: 'committee-a@example.invalid', displayName: 'Synthetic Committee A', role: 'COMMITTEE', groupIds: [groupA.id] });
await ensureUser({ email: 'operator-a@example.invalid', displayName: 'Synthetic Operator A', role: 'OPERATOR', groupIds: [groupA.id] });
await ensureUser({ email: 'employee-a@example.invalid', displayName: 'Synthetic Employee A', role: 'EMPLOYEE', groupIds: [groupA.id], employeeId: employeeA.id });

console.log(JSON.stringify({
  ok: true,
  syntheticOnly: true,
  groupA: groupA.id,
  groupB: groupB.id,
  employeeA: employeeA.id,
  employeeB: employeeB.id,
  identities: {
    admin: adminEmail,
    hr: 'hr@example.invalid',
    auditor: 'auditor@example.invalid',
    supervisorA: 'supervisor-a@example.invalid',
    supervisorB: 'supervisor-b@example.invalid',
    committeeA: 'committee-a@example.invalid',
    operatorA: 'operator-a@example.invalid',
    employeeA: 'employee-a@example.invalid',
  },
}, null, 2));
