import { describe, expect, it } from 'vitest';
import { AccessJwtValidationError } from './services/access-jwt.js';
import { accessFailureStatus, hasOrganizationWideRead, isCrossSiteMutation, isLoopbackRequestUrl } from './middleware.js';

describe('hasOrganizationWideRead', () => {
  it('allows organization-wide read only to ADMIN, HR and AUDITOR', () => {
    expect(hasOrganizationWideRead('ADMIN')).toBe(true);
    expect(hasOrganizationWideRead('HR')).toBe(true);
    expect(hasOrganizationWideRead('AUDITOR')).toBe(true);
  });

  it('keeps operational roles scoped to assigned groups', () => {
    expect(hasOrganizationWideRead('SUPERVISOR')).toBe(false);
    expect(hasOrganizationWideRead('COMMITTEE')).toBe(false);
    expect(hasOrganizationWideRead('OPERATOR')).toBe(false);
    expect(hasOrganizationWideRead('EMPLOYEE')).toBe(false);
  });
});

describe('isCrossSiteMutation', () => {
  it('rejects cross-site state-changing browser requests', () => {
    expect(isCrossSiteMutation('POST', 'cross-site')).toBe(true);
    expect(isCrossSiteMutation('PATCH', 'cross-site')).toBe(true);
    expect(isCrossSiteMutation('DELETE', 'cross-site')).toBe(true);
  });

  it('allows safe methods and trusted/non-browser clients', () => {
    expect(isCrossSiteMutation('GET', 'cross-site')).toBe(false);
    expect(isCrossSiteMutation('HEAD', 'cross-site')).toBe(false);
    expect(isCrossSiteMutation('OPTIONS', 'cross-site')).toBe(false);
    expect(isCrossSiteMutation('POST', 'same-origin')).toBe(false);
    expect(isCrossSiteMutation('POST', 'same-site')).toBe(false);
    expect(isCrossSiteMutation('POST', undefined)).toBe(false);
  });
});

describe('local development identity boundary', () => {
  it('accepts only loopback hosts as local development origins', () => {
    expect(isLoopbackRequestUrl('http://localhost:8787/v1/me')).toBe(true);
    expect(isLoopbackRequestUrl('http://127.0.0.1:8787/v1/me')).toBe(true);
    expect(isLoopbackRequestUrl('http://[::1]:8787/v1/me')).toBe(true);
    expect(isLoopbackRequestUrl('https://staging.example.com/v1/me')).toBe(false);
    expect(isLoopbackRequestUrl('not-a-url')).toBe(false);
  });
});

describe('Cloudflare Access failure classification', () => {
  it('treats invalid tokens as authentication failures', () => {
    expect(accessFailureStatus(new AccessJwtValidationError('ACCESS_TOKEN_SIGNATURE_INVALID'))).toBe(401);
    expect(accessFailureStatus(new AccessJwtValidationError('ACCESS_TOKEN_AUDIENCE_MISMATCH'))).toBe(401);
  });

  it('treats JWKS/configuration failures as service failures', () => {
    expect(accessFailureStatus(new AccessJwtValidationError('ACCESS_JWKS_UNAVAILABLE'))).toBe(503);
    expect(accessFailureStatus(new AccessJwtValidationError('ACCESS_TEAM_DOMAIN_INVALID'))).toBe(503);
  });
});
