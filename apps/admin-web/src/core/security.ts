import type { AppEnvironment } from './types.js';

const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeText(value: unknown): string {
  const text = value === null || value === undefined
    ? ''
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] ?? char);
}

export function safeExternalUrl(value: string, environment: AppEnvironment): string | null {
  try {
    const url = new URL(value, window.location.origin);
    if (url.protocol === 'https:') return url.toString();
    if (environment === 'development' && ['localhost', '127.0.0.1'].includes(url.hostname)) {
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function isProductionLike(environment: AppEnvironment): boolean {
  return environment === 'production';
}

export function canRunSyntheticDiagnostic(environment: AppEnvironment): boolean {
  return environment === 'development' || environment === 'staging';
}
