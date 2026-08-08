import { describe, expect, it } from 'vitest';
import {
  AccessJwtValidationError,
  normalizeAccessTeamOrigin,
  validateAccessClaims,
  verifyAccessJwtWithJwks,
  type AccessJwtClaims,
} from './access-jwt.js';

const config = {
  teamDomain: 'yrak.cloudflareaccess.com',
  audience: 'expected-aud',
};
const now = 2_000_000_000;

function claims(overrides: Partial<AccessJwtClaims> = {}): AccessJwtClaims {
  return {
    aud: 'expected-aud',
    email: 'admin@example.com',
    exp: now + 300,
    iss: 'https://yrak.cloudflareaccess.com',
    ...overrides,
  };
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function encodeJson(value: unknown): string {
  return encodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

async function signedToken(payload: AccessJwtClaims) {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  ) as CryptoKeyPair;
  const exported = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const jwk: JsonWebKey = { ...exported, kid: 'test-key', alg: 'RS256', use: 'sig' };
  const header = encodeJson({ alg: 'RS256', kid: 'test-key', typ: 'JWT' });
  const body = encodeJson(payload);
  const signingInput = `${header}.${body}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    pair.privateKey,
    new TextEncoder().encode(signingInput),
  );
  return { token: `${signingInput}.${encodeBytes(new Uint8Array(signature))}`, jwk, header };
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ name: 'AccessJwtValidationError', code });
}

describe('Cloudflare Access JWT claims', () => {
  it('normalizes a Cloudflare Access team domain to HTTPS origin', () => {
    expect(normalizeAccessTeamOrigin('yrak.cloudflareaccess.com')).toBe('https://yrak.cloudflareaccess.com');
    expect(() => normalizeAccessTeamOrigin('http://yrak.cloudflareaccess.com')).toThrow(AccessJwtValidationError);
    expect(() => normalizeAccessTeamOrigin('https://yrak.cloudflareaccess.com/path')).toThrow(AccessJwtValidationError);
  });

  it('accepts valid audience arrays and claims', () => {
    expect(() => validateAccessClaims(claims({ aud: ['other', 'expected-aud'] }), config, now)).not.toThrow();
  });

  it('rejects expired, future, wrong issuer, wrong audience and missing email claims', () => {
    expect(() => validateAccessClaims(claims({ exp: now }), config, now)).toThrow('ACCESS_TOKEN_EXPIRED');
    expect(() => validateAccessClaims(claims({ nbf: now + 120 }), config, now)).toThrow('ACCESS_TOKEN_NOT_YET_VALID');
    expect(() => validateAccessClaims(claims({ iss: 'https://other.cloudflareaccess.com' }), config, now)).toThrow('ACCESS_TOKEN_ISSUER_MISMATCH');
    expect(() => validateAccessClaims(claims({ aud: 'wrong' }), config, now)).toThrow('ACCESS_TOKEN_AUDIENCE_MISMATCH');
    expect(() => validateAccessClaims(claims({ email: '' }), config, now)).toThrow('ACCESS_TOKEN_EMAIL_MISSING');
  });
});

describe('Cloudflare Access JWT signature', () => {
  it('verifies a correctly signed RS256 token', async () => {
    const fixture = await signedToken(claims());
    await expect(verifyAccessJwtWithJwks(fixture.token, [fixture.jwk], config, now)).resolves.toMatchObject({
      email: 'admin@example.com',
      aud: 'expected-aud',
    });
  });

  it('rejects a payload changed after signing', async () => {
    const fixture = await signedToken(claims());
    const segments = fixture.token.split('.');
    const tamperedPayload = encodeJson(claims({ email: 'attacker@example.com' }));
    const tampered = `${fixture.header}.${tamperedPayload}.${segments[2]}`;
    await expectCode(verifyAccessJwtWithJwks(tampered, [fixture.jwk], config, now), 'ACCESS_TOKEN_SIGNATURE_INVALID');
  });

  it('rejects keys that do not match the token kid', async () => {
    const fixture = await signedToken(claims());
    await expectCode(verifyAccessJwtWithJwks(fixture.token, [{ ...fixture.jwk, kid: 'other-key' }], config, now), 'ACCESS_TOKEN_KEY_NOT_FOUND');
  });
});
