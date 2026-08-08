import { describe, expect, it } from 'vitest';
import { exceedsAgentBodyLimit, isKnownAgentKind, isValidSessionId, MAX_AGENT_BODY_BYTES } from './index.js';

describe('agent request guards', () => {
  it('accepts only the four registered agent kinds', () => {
    expect(isKnownAgentKind('intake')).toBe(true);
    expect(isKnownAgentKind('audit')).toBe(true);
    expect(isKnownAgentKind('communication')).toBe(true);
    expect(isKnownAgentKind('support')).toBe(true);
    expect(isKnownAgentKind('winner-selector')).toBe(false);
  });

  it('bounds durable-object session identifiers', () => {
    expect(isValidSessionId('smoke-session-1')).toBe(true);
    expect(isValidSessionId('')).toBe(false);
    expect(isValidSessionId('x'.repeat(161))).toBe(false);
  });

  it('rejects payloads larger than the byte limit including multibyte text', () => {
    expect(exceedsAgentBodyLimit('x'.repeat(MAX_AGENT_BODY_BYTES))).toBe(false);
    expect(exceedsAgentBodyLimit('x'.repeat(MAX_AGENT_BODY_BYTES + 1))).toBe(true);
    expect(exceedsAgentBodyLimit('á'.repeat(MAX_AGENT_BODY_BYTES / 2 + 1))).toBe(true);
  });
});
