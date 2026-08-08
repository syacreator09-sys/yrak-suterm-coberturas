import { describe, expect, it } from 'vitest';
import { escapeText, isProductionLike, canRunSyntheticDiagnostic } from './security.js';

describe('browser security helpers', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeText(`<script>alert("x")</script>`)).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  });

  it('serializes and escapes objects instead of trusting HTML', () => {
    expect(escapeText({ x: '<img>' })).toContain('&lt;img&gt;');
  });

  it('keeps production diagnostics disabled by default', () => {
    expect(isProductionLike('production')).toBe(true);
    expect(canRunSyntheticDiagnostic('production')).toBe(false);
    expect(canRunSyntheticDiagnostic('staging')).toBe(true);
  });
});
