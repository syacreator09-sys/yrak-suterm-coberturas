import { ApiError } from './api-client.js';
import { escapeText } from './security.js';
import { renderAlert } from '../components/ui.js';

export function optionsHtml(
  items: readonly Record<string, unknown>[],
  valueKey = 'id',
  labelKey = 'name',
): string {
  return items.map((item) => {
    const value = item[valueKey];
    const label = item[labelKey] ?? value;
    return `<option value="${escapeText(value)}">${escapeText(label)}</option>`;
  }).join('');
}

export function renderPageError(error: unknown): string {
  if (error instanceof ApiError) return renderAlert(error.code, 'danger', error.correlationId);
  return renderAlert(error instanceof Error ? error.message : error, 'danger');
}

export function nullableText(value: string): string | null {
  const text = value.trim();
  return text ? text : null;
}

export function parseCsvIds(value: string): string[] {
  return [...new Set(value.split(',').map((part) => part.trim()).filter(Boolean))];
}

export function numberOrNull(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) throw new Error('INVALID_NUMBER');
  return parsed;
}
