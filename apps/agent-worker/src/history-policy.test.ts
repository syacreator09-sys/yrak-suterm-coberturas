import { describe, expect, it } from 'vitest';
import {
  redactSensitiveFields,
  sanitizeAuditFactsForModel,
  sanitizeHistoryInput,
  sanitizeHistoryOutput,
} from './history-policy.js';

describe('agent history minimization', () => {
  it('never stores raw intake text', () => {
    const result = sanitizeHistoryInput('intake', { text: 'employee confidential document' });
    expect(result).toEqual({ hasText: true, textChars: 30 });
    expect(JSON.stringify(result)).not.toContain('confidential');
  });

  it('stores only identifiers/purpose for communication input', () => {
    expect(sanitizeHistoryInput('communication', {
      coverageCaseId: 'case-1',
      purpose: 'notification',
      email: 'person@example.com',
      name: 'Person Name',
    })).toEqual({ coverageCaseId: 'case-1', purpose: 'notification' });
  });

  it('does not persist extracted intake payloads or raw audit facts', () => {
    expect(sanitizeHistoryOutput('intake', { employeeName: 'Secret' })).toEqual({ completed: true, extractedPayloadStored: false });
    const audit = sanitizeHistoryOutput('audit', { facts: [{ email: 'x@example.com' }], explanation: 'Observed sequence.' });
    expect(audit).toMatchObject({ factCount: 1, rawFactsStored: false, explanation: 'Observed sequence.' });
    expect(JSON.stringify(audit)).not.toContain('x@example.com');
  });
});

describe('agent model payload redaction', () => {
  it('redacts common PII keys recursively', () => {
    expect(redactSensitiveFields({
      email: 'person@example.com',
      nested: { display_name: 'Person', safe: 'kept' },
      employee_number: '12345',
    })).toEqual({
      email: '[REDACTED]',
      nested: { display_name: '[REDACTED]', safe: 'kept' },
      employee_number: '[REDACTED]',
    });
  });

  it('parses/redacts audit previous/new JSON before model use', () => {
    const result = sanitizeAuditFactsForModel([{
      actor_role: 'HR',
      action: 'UPDATED',
      previous_value_json: JSON.stringify({ email: 'old@example.com', status: 'OLD' }),
      new_value_json: JSON.stringify({ email: 'new@example.com', status: 'NEW' }),
      rule_applied: 'RULE',
      reason: 'test',
      created_at: '2026-08-07T00:00:00Z',
    }]);
    expect(result[0]).toMatchObject({
      previous_value: { email: '[REDACTED]', status: 'OLD' },
      new_value: { email: '[REDACTED]', status: 'NEW' },
    });
    expect(JSON.stringify(result)).not.toContain('@example.com');
  });
});
