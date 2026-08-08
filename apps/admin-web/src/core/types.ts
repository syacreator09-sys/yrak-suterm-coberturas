export type AppRole =
  | 'ADMIN'
  | 'HR'
  | 'SUPERVISOR'
  | 'COMMITTEE'
  | 'OPERATOR'
  | 'EMPLOYEE'
  | 'AUDITOR';

export type AppEnvironment = 'development' | 'staging' | 'production';

export interface SessionUser {
  id: string;
  organizationId: string;
  email: string;
  role: AppRole;
  employeeId?: string;
}

export interface AppSession {
  user: SessionUser;
  employee: Record<string, unknown> | null;
}

export type AppSection =
  | 'overview'
  | 'coverages'
  | 'rotations'
  | 'competitions'
  | 'employees'
  | 'requirements'
  | 'documents'
  | 'rag'
  | 'ai'
  | 'infrastructure'
  | 'audit'
  | 'reports'
  | 'settings';

export type IntegrationHealth = 'healthy' | 'degraded' | 'down' | 'not_configured' | 'unknown';

export interface ApiFailureShape {
  error?: string;
  message?: string;
  [key: string]: unknown;
}

export interface ListResponse<T = Record<string, unknown>> {
  items: T[];
}

export interface AppRuntimeConfig {
  environment: AppEnvironment;
  apiBaseUrl: string;
  employeePortalUrl?: string;
}
