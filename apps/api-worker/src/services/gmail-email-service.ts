import type { AppEnv, SendEmailLike } from '../env.js';

interface GmailConfig { clientId: string; clientSecret: string; refreshToken: string; sender: string }

function base64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeSubject(subject: string): string {
  const bytes = new TextEncoder().encode(subject);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

export function buildMimeMessage(message: { from: string; to: string; subject: string; text?: string; html?: string }): string {
  const boundary = 'yrak-' + crypto.randomUUID();
  const lines = [
    `From: ${message.from}`,
    `To: ${message.to}`,
    `Subject: ${encodeSubject(message.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    message.text ?? '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    message.html ?? `<pre>${message.text ?? ''}</pre>`,
    `--${boundary}--`,
  ];
  return base64Url(lines.join('\r\n'));
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(config: GmailConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId, client_secret: config.clientSecret,
      refresh_token: config.refreshToken, grant_type: 'refresh_token',
    }),
  });
  const json = await response.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !json.access_token) throw new Error(`GMAIL_TOKEN_ERROR:${json.error ?? response.status}`);
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

export class GmailEmailSender implements SendEmailLike {
  constructor(private readonly config: GmailConfig) {}
  async send(message: { from: string | { email: string; name?: string }; to: string | string[]; subject: string; text?: string; html?: string }): Promise<{ messageId?: string }> {
    const from = typeof message.from === 'string' ? message.from : message.from.email;
    const to = Array.isArray(message.to) ? message.to.join(', ') : message.to;
    const raw = buildMimeMessage({ from, to, subject: message.subject, ...(message.text !== undefined ? { text: message.text } : {}), ...(message.html !== undefined ? { html: message.html } : {}) });
    const token = await accessToken(this.config);
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    const json = await response.json() as { id?: string; error?: { message?: string } };
    if (!response.ok) throw new Error(`GMAIL_SEND_ERROR:${json.error?.message ?? response.status}`);
    return { ...(json.id ? { messageId: json.id } : {}) };
  }
}

export function resolveEmailSender(env: AppEnv): { sender: SendEmailLike; from: string } | undefined {
  if (env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN && env.GMAIL_SENDER) {
    return { sender: new GmailEmailSender({ clientId: env.GMAIL_CLIENT_ID, clientSecret: env.GMAIL_CLIENT_SECRET, refreshToken: env.GMAIL_REFRESH_TOKEN, sender: env.GMAIL_SENDER }), from: env.GMAIL_SENDER };
  }
  if (env.EMAIL && env.EMAIL_FROM && !env.EMAIL_FROM.startsWith('REPLACE_')) return { sender: env.EMAIL, from: env.EMAIL_FROM };
  return undefined;
}
