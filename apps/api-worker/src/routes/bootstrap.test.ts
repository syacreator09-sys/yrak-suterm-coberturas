import { describe, expect, it } from 'vitest';
import { bootstrapAllowed, bootstrapEnabled } from './bootstrap.js';

describe('bootstrapEnabled', () => {
  it('is fail-closed unless explicitly true', () => {
    expect(bootstrapEnabled(undefined)).toBe(false);
    expect(bootstrapEnabled('')).toBe(false);
    expect(bootstrapEnabled('false')).toBe(false);
    expect(bootstrapEnabled('1')).toBe(false);
    expect(bootstrapEnabled('true')).toBe(true);
    expect(bootstrapEnabled(' TRUE ')).toBe(true);
  });
});

describe('bootstrapAllowed', () => {
  it('allows development bootstrap only on loopback', () => {
    expect(bootstrapAllowed('development', 'http://127.0.0.1:8787/bootstrap', 'true')).toBe(true);
    expect(bootstrapAllowed('development', 'http://localhost:8787/bootstrap', 'true')).toBe(true);
    expect(bootstrapAllowed('development', 'https://dev.example.com/bootstrap', 'true')).toBe(false);
  });

  it('allows staging only when explicitly enabled', () => {
    expect(bootstrapAllowed('staging', 'https://staging.example.com/bootstrap', 'true')).toBe(true);
    expect(bootstrapAllowed('staging', 'https://staging.example.com/bootstrap', 'false')).toBe(false);
  });

  it('never allows production bootstrap even when enabled', () => {
    expect(bootstrapAllowed('production', 'https://control.example.com/bootstrap', 'true')).toBe(false);
  });
});
