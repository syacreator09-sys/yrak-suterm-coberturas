import { api } from './api-client.js';
import type { AppSession, SessionUser } from './types.js';

interface MeResponse {
  user: SessionUser;
  employee: Record<string, unknown> | null;
}

export async function loadSession(): Promise<AppSession> {
  const data = await api.get<MeResponse>('/v1/me');
  return { user: data.user, employee: data.employee ?? null };
}

export function employeePortalUrl(): string | null {
  const configured = (import.meta.env.VITE_EMPLOYEE_PORTAL_URL as string | undefined)?.trim();
  return configured || null;
}
