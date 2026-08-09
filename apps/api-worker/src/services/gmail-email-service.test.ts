import { describe, expect, it } from 'vitest';
import { buildMimeMessage } from './gmail-email-service.js';

describe('buildMimeMessage', () => {
  it('genera multipart/alternative con subject UTF-8 y ambos cuerpos', () => {
    const raw = buildMimeMessage({ from: 'a@b.c', to: 'x@y.z', subject: 'Oferta – nivel 8', text: 'hola', html: '<b>hola</b>' });
    const decoded = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
    expect(decoded).toContain('To: x@y.z');
    expect(decoded).toContain('Content-Type: multipart/alternative');
    expect(decoded).toContain('=?UTF-8?B?');
    expect(decoded).toContain('<b>hola</b>');
  });
});
