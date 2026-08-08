export interface AccessJwtClaims {
  aud: string | string[];
  email: string;
  exp: number;
  iat?: number;
  iss: string;
  nbf?: number;
  sub?: string;
  [key: string]: unknown;
}

interface JwtHeader {
  alg: string;
  kid: string;
  typ?: string;
}

interface JwksResponse {
  keys: JsonWebKey[];
}

export interface AccessJwtConfig {
  teamDomain: string;
  audience: string;
}

interface CachedJwks {
  expiresAt: number;
  keys: JsonWebKey[];
}

const JWKS_TTL_MS = 5 * 60 * 1000;
const jwksCache = new Map<string, CachedJwks>();

export class AccessJwtValidationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'AccessJwtValidationError';
  }
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    throw new AccessJwtValidationError('ACCESS_TOKEN_MALFORMED');
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function parseSegment<T>(segment: string): T {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment))) as T;
  } catch (error) {
    if (error instanceof AccessJwtValidationError) throw error;
    throw new AccessJwtValidationError('ACCESS_TOKEN_MALFORMED');
  }
}

export function normalizeAccessTeamOrigin(teamDomain: string): string {
  const trimmed = teamDomain.trim();
  if (!trimmed || trimmed.startsWith('REPLACE_')) throw new AccessJwtValidationError('ACCESS_TEAM_DOMAIN_REQUIRED');
  const raw = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AccessJwtValidationError('ACCESS_TEAM_DOMAIN_INVALID');
  }
  const hostname = url.hostname.toLowerCase();
  const validCloudflareTeamDomain = hostname.endsWith('.cloudflareaccess.com') && hostname !== 'cloudflareaccess.com';
  if (
    url.protocol !== 'https:' ||
    !validCloudflareTeamDomain ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname && url.pathname !== '/') ||
    url.port
  ) {
    throw new AccessJwtValidationError('ACCESS_TEAM_DOMAIN_INVALID');
  }
  return url.origin;
}

export function validateAccessClaims(
  claims: AccessJwtClaims,
  config: AccessJwtConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): void {
  if (!claims.email || typeof claims.email !== 'string') throw new AccessJwtValidationError('ACCESS_TOKEN_EMAIL_MISSING');
  if (!Number.isFinite(claims.exp) || claims.exp <= nowSeconds) throw new AccessJwtValidationError('ACCESS_TOKEN_EXPIRED');
  if (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > nowSeconds + 60)) {
    throw new AccessJwtValidationError('ACCESS_TOKEN_NOT_YET_VALID');
  }
  const expectedIssuer = normalizeAccessTeamOrigin(config.teamDomain);
  let issuer: string;
  try {
    issuer = new URL(claims.iss).origin;
  } catch {
    throw new AccessJwtValidationError('ACCESS_TOKEN_ISSUER_INVALID');
  }
  if (issuer !== expectedIssuer) throw new AccessJwtValidationError('ACCESS_TOKEN_ISSUER_MISMATCH');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(config.audience)) throw new AccessJwtValidationError('ACCESS_TOKEN_AUDIENCE_MISMATCH');
}

async function importVerificationKey(jwk: JsonWebKey): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
  } catch {
    throw new AccessJwtValidationError('ACCESS_JWK_INVALID');
  }
}

export async function verifyAccessJwtWithJwks(
  token: string,
  keys: readonly JsonWebKey[],
  config: AccessJwtConfig,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<AccessJwtClaims> {
  const segments = token.split('.');
  if (segments.length !== 3) throw new AccessJwtValidationError('ACCESS_TOKEN_MALFORMED');
  const [headerSegment, payloadSegment, signatureSegment] = segments as [string, string, string];
  const header = parseSegment<JwtHeader>(headerSegment);
  if (header.alg !== 'RS256' || !header.kid) throw new AccessJwtValidationError('ACCESS_TOKEN_ALGORITHM_INVALID');
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new AccessJwtValidationError('ACCESS_TOKEN_KEY_NOT_FOUND');
  const key = await importVerificationKey(jwk);
  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    decodeBase64Url(signatureSegment),
    new TextEncoder().encode(`${headerSegment}.${payloadSegment}`),
  );
  if (!verified) throw new AccessJwtValidationError('ACCESS_TOKEN_SIGNATURE_INVALID');
  const claims = parseSegment<AccessJwtClaims>(payloadSegment);
  validateAccessClaims(claims, config, nowSeconds);
  return claims;
}

async function fetchJwks(
  origin: string,
  fetchImpl: typeof fetch,
  forceRefresh = false,
): Promise<JsonWebKey[]> {
  const now = Date.now();
  const cached = jwksCache.get(origin);
  if (!forceRefresh && cached && cached.expiresAt > now) return cached.keys;
  let response: Response;
  try {
    response = await fetchImpl(`${origin}/cdn-cgi/access/certs`, {
      headers: { accept: 'application/json' },
    });
  } catch {
    throw new AccessJwtValidationError('ACCESS_JWKS_UNAVAILABLE');
  }
  if (!response.ok) throw new AccessJwtValidationError('ACCESS_JWKS_UNAVAILABLE');
  const body = await response.json().catch(() => null) as JwksResponse | null;
  if (!body || !Array.isArray(body.keys) || !body.keys.length) throw new AccessJwtValidationError('ACCESS_JWKS_INVALID');
  jwksCache.set(origin, { expiresAt: now + JWKS_TTL_MS, keys: body.keys });
  return body.keys;
}

export async function verifyAccessJwt(
  token: string,
  config: AccessJwtConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<AccessJwtClaims> {
  const origin = normalizeAccessTeamOrigin(config.teamDomain);
  const keys = await fetchJwks(origin, fetchImpl);
  try {
    return await verifyAccessJwtWithJwks(token, keys, config);
  } catch (error) {
    if (!(error instanceof AccessJwtValidationError) || error.code !== 'ACCESS_TOKEN_KEY_NOT_FOUND') throw error;
    const refreshed = await fetchJwks(origin, fetchImpl, true);
    return verifyAccessJwtWithJwks(token, refreshed, config);
  }
}
