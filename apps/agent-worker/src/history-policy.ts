import type { AgentKind } from './session.js';

const MAX_HISTORY_TEXT = 4_000;
const SENSITIVE_KEYS = /(^|_)(email|e_mail|name|display_name|employee_number|phone|telephone|mobile|recipient|address|street|rfc|curp|ssn)($|_)/i;

function boundedText(value: unknown, max = MAX_HISTORY_TEXT): string {
  const text = String(value ?? '').trim();
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export function sanitizeHistoryInput(kind: AgentKind, input: Record<string, unknown>): Record<string, unknown> {
  if (kind === 'intake') {
    const text = String(input.text ?? '');
    return { hasText: Boolean(text.trim()), textChars: text.length };
  }
  if (kind === 'audit') {
    return {
      entityType: boundedText(input.entityType, 80),
      entityId: boundedText(input.entityId, 160),
      question: boundedText(input.question),
    };
  }
  if (kind === 'communication') {
    return {
      coverageCaseId: boundedText(input.coverageCaseId, 160),
      purpose: boundedText(input.purpose, 160),
    };
  }
  return { question: boundedText(input.question) };
}

export function sanitizeHistoryOutput(kind: AgentKind, result: unknown): Record<string, unknown> {
  const body = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  if (kind === 'intake') return { completed: true, extractedPayloadStored: false };
  if (kind === 'audit') {
    return {
      explanation: boundedText(body.explanation, 8_000),
      factCount: Array.isArray(body.facts) ? body.facts.length : 0,
      rawFactsStored: false,
    };
  }
  if (kind === 'communication') {
    return {
      draft: boundedText(body.draft, 8_000),
      requiresHumanSendApproval: body.requiresHumanSendApproval === true,
      rawFactsStored: false,
    };
  }
  return { answer: boundedText(body.answer, 8_000) };
}

export function redactSensitiveFields(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[REDACTED_DEPTH]';
  if (Array.isArray(value)) return value.map((item) => redactSensitiveFields(item, depth + 1));
  if (!value || typeof value !== 'object') return value;

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEYS.test(key) ? '[REDACTED]' : redactSensitiveFields(item, depth + 1);
  }
  return output;
}

export function redactJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return redactSensitiveFields(value);
  try {
    return redactSensitiveFields(JSON.parse(value));
  } catch {
    return value;
  }
}

export function sanitizeAuditFactsForModel(rows: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => ({
    actor_role: row.actor_role,
    action: row.action,
    previous_value: redactJsonValue(row.previous_value_json),
    new_value: redactJsonValue(row.new_value_json),
    rule_applied: row.rule_applied,
    reason: row.reason,
    created_at: row.created_at,
  }));
}
