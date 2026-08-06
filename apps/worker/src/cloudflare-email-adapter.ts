import { EmailMessage } from 'cloudflare:email';

export interface PlainTextEmailPayload {
  from: string | { email: string; name?: string };
  to: string | { email: string; name?: string } | Array<string | { email: string; name?: string }>;
  subject: string;
  text: string;
  html?: string;
}

interface SendEmailBinding {
  send(message: EmailMessage): Promise<void>;
}

function address(value: string | { email: string; name?: string }): string {
  if (typeof value === 'string') return value;
  return value.name ? `${value.name} <${value.email}>` : value.email;
}

function escapeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function createRawMessage(payload: PlainTextEmailPayload, recipient: string): string {
  const from = address(payload.from);
  const boundary = `yrak-${crypto.randomUUID()}`;
  const headers = [
    `From: ${escapeHeader(from)}`,
    `To: ${escapeHeader(recipient)}`,
    `Subject: ${escapeHeader(payload.subject)}`,
    'MIME-Version: 1.0',
  ];
  if (payload.html) {
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      payload.text,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      payload.html,
      `--${boundary}--`,
      '',
    ].join('\r\n');
  }
  return [
    ...headers,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    payload.text,
    '',
  ].join('\r\n');
}

export function createEmailPayloadAdapter(binding: SendEmailBinding): {
  send(payload: PlainTextEmailPayload): Promise<void>;
} {
  return {
    async send(payload) {
      const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
      for (const recipientValue of recipients) {
        const recipient = address(recipientValue);
        const sender = typeof payload.from === 'string' ? payload.from : payload.from.email;
        const recipientEmail =
          typeof recipientValue === 'string' ? recipientValue : recipientValue.email;
        await binding.send(
          new EmailMessage(sender, recipientEmail, createRawMessage(payload, recipient)),
        );
      }
    },
  };
}
