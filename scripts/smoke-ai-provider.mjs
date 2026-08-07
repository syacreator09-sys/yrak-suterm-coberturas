#!/usr/bin/env node

const baseUrl = process.env.AI_COMPAT_BASE_URL?.replace(/\/$/, '');
const model = process.env.AI_COMPAT_TEXT_MODEL;
const apiKey = process.env.AI_COMPAT_API_KEY;
const providerId = process.env.AI_COMPAT_PROVIDER_ID ?? 'compatible';
const expected = process.env.AI_SMOKE_EXPECT;
const timeoutMs = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 30000);

if (!baseUrl || !model) {
  console.error('Missing AI_COMPAT_BASE_URL or AI_COMPAT_TEXT_MODEL');
  process.exit(2);
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 30000);
const started = Date.now();

try {
  const headers = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    signal: controller.signal,
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: 'You are a connectivity smoke test. Do not use tools.' },
        { role: 'user', content: expected ? `Include this exact token in your answer: ${expected}` : 'Reply briefly to confirm the model is reachable.' },
      ],
    }),
  });

  const raw = await response.text();
  let json;
  try { json = JSON.parse(raw); } catch { json = null; }

  if (!response.ok) {
    console.error(JSON.stringify({ providerId, model, ok: false, status: response.status, latencyMs: Date.now() - started }));
    process.exit(1);
  }

  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    console.error(JSON.stringify({ providerId, model, ok: false, error: 'EMPTY_OR_INCOMPATIBLE_RESPONSE', latencyMs: Date.now() - started }));
    process.exit(1);
  }
  if (expected && !text.includes(expected)) {
    console.error(JSON.stringify({ providerId, model, ok: false, error: 'EXPECTED_TOKEN_NOT_FOUND', latencyMs: Date.now() - started }));
    process.exit(1);
  }

  console.log(JSON.stringify({ providerId, model, ok: true, latencyMs: Date.now() - started, responseChars: text.length }));
} catch (error) {
  const code = error?.name === 'AbortError' ? 'TIMEOUT' : 'REQUEST_FAILED';
  console.error(JSON.stringify({ providerId, model, ok: false, error: code, latencyMs: Date.now() - started }));
  process.exit(1);
} finally {
  clearTimeout(timer);
}
