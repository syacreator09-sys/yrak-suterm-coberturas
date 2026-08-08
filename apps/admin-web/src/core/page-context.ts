import type { AppEnvironment, AppSession } from './types.js';

export interface PageContext {
  root: HTMLElement;
  session: AppSession;
  environment: AppEnvironment;
  setTitle(title: string, subtitle?: string): void;
  setGlobalStatus(label: string, tone?: 'success'|'warning'|'danger'|'neutral'): void;
}
