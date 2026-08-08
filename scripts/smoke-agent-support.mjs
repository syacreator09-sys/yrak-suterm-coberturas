#!/usr/bin/env node
const baseUrl = (process.env.AGENT_BASE_URL ?? 'http://127.0.0.1:8788').replace(/\/$/, '');
const token = process.env.AGENT_API_TOKEN;
const sessionId = `smoke-${crypto.randomUUID()}`;

if (!token) {
  console.error('AGENT_API_TOKEN_REQUIRED');
  process.exit(2);
}

const url = new URL(baseUrl);
const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname.toLowerCase());
if (!local && process.env.CONFIRM_REMOTE_STAGING_TEST !== 'YES') {
  console.error('REFUSING_REMOTE_TEST: set CONFIRM_REMOTE_STAGING_TEST=YES only for an authorized staging Agent Worker.');
  process.exit(2);
}

const response = await fetch(`${baseUrl}/v1/support/${sessionId}`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    question: 'Prueba sintética: una cobertura tiene 4 días efectivos. Indica únicamente qué tipo de proceso corresponde según las reglas duras de YRAK.',
  }),
});

if (!response.ok) {
  console.error(`FAIL: support agent returned HTTP ${response.status}: ${await response.text()}`);
  process.exit(1);
}

const body = await response.json();
const answer = body?.result?.answer;
if (typeof answer !== 'string' || !answer.trim()) {
  console.error('FAIL: support agent returned no textual answer');
  process.exit(1);
}
const normalized = answer.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
if (!normalized.includes('rotacion')) {
  console.error('FAIL: support agent did not preserve the 1–5 day ROTATION invariant');
  process.exit(1);
}

const history = await fetch(`${baseUrl}/v1/support/${sessionId}/history`, {
  headers: { authorization: `Bearer ${token}` },
});
if (!history.ok) {
  console.error(`FAIL: support history returned HTTP ${history.status}`);
  process.exit(1);
}
const historyBody = await history.json();
if (!Array.isArray(historyBody?.items) || historyBody.items.length < 2) {
  console.error('FAIL: durable session history did not persist user + assistant messages');
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  agent: 'support',
  invariant: '1-5_days_rotation',
  sessionPersisted: true,
  answerCharacters: answer.length,
}, null, 2));
