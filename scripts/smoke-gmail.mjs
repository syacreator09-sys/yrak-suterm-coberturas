#!/usr/bin/env node
const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
const testAddress = process.env.GMAIL_TEST_ADDRESS?.trim();
const sendConfirmed = process.env.CONFIRM_GMAIL_SEND_TEST === 'YES';

for (const [name, value] of Object.entries({
  GOOGLE_OAUTH_CLIENT_ID: clientId,
  GOOGLE_OAUTH_CLIENT_SECRET: clientSecret,
  GOOGLE_OAUTH_REFRESH_TOKEN: refreshToken,
})) {
  if (!value) {
    console.error(`${name}_REQUIRED`);
    process.exit(2);
  }
}

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }),
});
if (!tokenResponse.ok) {
  console.error(`FAIL: Google OAuth refresh returned HTTP ${tokenResponse.status}. Re-authorize the test account; response body intentionally not printed.`);
  process.exit(1);
}
const tokenBody = await tokenResponse.json();
const accessToken = typeof tokenBody?.access_token === 'string' ? tokenBody.access_token : '';
if (!accessToken) {
  console.error('FAIL: OAuth response contained no access_token');
  process.exit(1);
}

if (!sendConfirmed) {
  console.log(JSON.stringify({
    ok: true,
    oauthRefresh: true,
    messageSent: false,
    next: 'Set CONFIRM_GMAIL_SEND_TEST=YES and GMAIL_TEST_ADDRESS to perform a self-send synthetic smoke.',
  }, null, 2));
  process.exit(0);
}

if (!testAddress) {
  console.error('GMAIL_TEST_ADDRESS_REQUIRED_FOR_SEND');
  process.exit(2);
}
if (/[\r\n]/.test(testAddress) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testAddress)) {
  console.error('INVALID_GMAIL_TEST_ADDRESS');
  process.exit(2);
}

function base64Url(text) {
  return Buffer.from(text, 'utf8').toString('base64url');
}

const timestamp = new Date().toISOString();
const messageId = `<yrak-smoke-${crypto.randomUUID()}@local.invalid>`;
const mime = [
  `From: ${testAddress}`,
  `To: ${testAddress}`,
  'Subject: YRAK Gmail API smoke test',
  `Date: ${new Date().toUTCString()}`,
  `Message-ID: ${messageId}`,
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: 8bit',
  '',
  `YRAK synthetic Gmail connection test. Timestamp: ${timestamp}`,
  'No labor data or production content is included.',
].join('\r\n');

const sendResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
  method: 'POST',
  headers: {
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
    accept: 'application/json',
  },
  body: JSON.stringify({ raw: base64Url(mime) }),
});
if (!sendResponse.ok) {
  console.error(`FAIL: Gmail messages.send returned HTTP ${sendResponse.status}. Response body intentionally not printed.`);
  process.exit(1);
}
const sendBody = await sendResponse.json();
if (typeof sendBody?.id !== 'string' || !sendBody.id) {
  console.error('FAIL: Gmail send response contained no message id');
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  oauthRefresh: true,
  messageSent: true,
  selfSendOnly: true,
  gmailMessageIdPresent: true,
}, null, 2));
