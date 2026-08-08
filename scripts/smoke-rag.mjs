#!/usr/bin/env node
const baseUrl = (process.env.API_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const url = new URL(baseUrl);
const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname.toLowerCase());
const requireResults = process.env.REQUIRE_RAG_RESULTS === 'YES';

if (!local && process.env.CONFIRM_REMOTE_STAGING_TEST !== 'YES') {
  console.error('REFUSING_REMOTE_TEST: set CONFIRM_REMOTE_STAGING_TEST=YES only for an authorized staging API.');
  process.exit(2);
}

const headers = new Headers({ 'content-type': 'application/json' });
if (local) {
  headers.set('x-yrak-user-email', process.env.DEV_USER_EMAIL ?? 'admin@example.com');
} else {
  const jwt = process.env.CF_ACCESS_JWT?.trim();
  if (!jwt) {
    console.error('CF_ACCESS_JWT_REQUIRED for remote staging RAG smoke. Do not place this token in Git or command history.');
    process.exit(2);
  }
  headers.set('Cf-Access-Jwt-Assertion', jwt);
}

const response = await fetch(`${baseUrl}/v1/rag/search`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    query: 'Prueba sintética de conectividad RAG YRAK. Recupera únicamente documentos autorizados si existen.',
    topK: 3,
  }),
});

if (!response.ok) {
  console.error(`FAIL: RAG search returned HTTP ${response.status}: ${await response.text()}`);
  process.exit(1);
}

const body = await response.json();
if (!Array.isArray(body?.items) || !Array.isArray(body?.citations)) {
  console.error('FAIL: RAG response does not contain items/citations arrays');
  process.exit(1);
}
if (body.citations.some((citation) => !citation || typeof citation.documentId !== 'string' || typeof citation.chunkId !== 'string')) {
  console.error('FAIL: RAG returned malformed citation metadata');
  process.exit(1);
}
if (requireResults && (!body.items.length || !body.citations.length)) {
  console.error('FAIL: REQUIRE_RAG_RESULTS=YES but no authorized indexed result/citation was returned');
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  retrievalRuntimeConnected: true,
  resultCount: body.items.length,
  citationCount: body.citations.length,
  requiredResults: requireResults,
}, null, 2));
