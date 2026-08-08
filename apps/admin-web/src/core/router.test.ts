import { describe, expect, it } from 'vitest';
import { routeForHash } from './router.js';

describe('routeForHash', () => {
  it('resolves known Control Center sections', () => {
    expect(routeForHash('#/coverages').section).toBe('coverages');
    expect(routeForHash('#/infrastructure').section).toBe('infrastructure');
  });

  it('falls back to overview for unknown or empty hashes', () => {
    expect(routeForHash('#/does-not-exist').section).toBe('overview');
    expect(routeForHash('').section).toBe('overview');
  });

  it('ignores nested path segments and query text', () => {
    expect(routeForHash('#/audit/COVERAGE_CASE/123?x=1').section).toBe('audit');
  });
});
