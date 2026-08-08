#!/usr/bin/env node

const baseUrl = (process.env.API_BASE_URL ?? '').replace(/\/$/, '');
if (!baseUrl) {
  console.error('API_BASE_URL_REQUIRED');
  process.exit(2);
}
const url = new URL(baseUrl);
const local = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
if (local) {
  console.error('ACCESS_AUTH_SMOKE_REQUIRES_REMOTE_STAGING: this check is specifically for a Cloudflare Access protected remote environment.');
  process.exit(2);
}
if (process.env.CONFIRM_ACCESS_STAGING_TEST !== 'YES') {
  console.error('REFUSING_REMOTE_TEST: set CONFIRM_ACCESS_STAGING_TEST=YES only for the authorized staging URL.');
  process.exit(2);
}

const spoofEmail = process.env.SPOOF_TEST_EMAIL ?? 'admin@example.invalid';
const response = await fetch(`${baseUrl}/v1/me`, {
  headers: {
    'x-yrak-user-email': spoofEmail,
    'x-correlation-id': `access-smoke-${crypto.randomUUID()}`,
  },
  redirect: 'manual',
});

if (response.status === 200) {
  console.error('FAIL: remote API accepted x-yrak-user-email without a validated Access session/JWT. DO NOT DEPLOY PRODUCTION.');
  process.exit(1);
}

if (![301, 302, 303, 307, 308, 401, 403].includes(response.status)) {
  console.error(`FAIL: expected Access redirect or authentication rejection, got HTTP ${response.status}. Review staging configuration.`);
  process.exit(1);
}

console.log(`PASS: spoofed development identity was not accepted remotely (HTTP ${response.status}).`);
