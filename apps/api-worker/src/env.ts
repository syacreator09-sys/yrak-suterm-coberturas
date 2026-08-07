import type { GroupCoordinator } from './group-coordinator.js';

export interface WorkflowBindingLike<T> {
  create(options: { id?: string; params: T }): Promise<{ id: string }>;
}
export interface SendEmailLike {
  send(message: { from: string | { email: string; name?: string }; to: string | string[]; subject: string; text?: string; html?: string }): Promise<{ messageId?: string }>;
}

export interface AppEnv {
  APP_ENV: 'development' | 'staging' | 'production';
  DEFAULT_TIMEZONE: string;
  EMAIL_FROM?: string;
  DB: D1Database;
  EVIDENCE_BUCKET?: R2Bucket;
  AI?: Ai;
  EMAIL?: SendEmailLike;
  GROUP_COORDINATOR: DurableObjectNamespace<GroupCoordinator>;
  COVERAGE_WORKFLOW?: WorkflowBindingLike<{ coverageCaseId: string; startsOn: string; endsOn: string }>;
  NOTIFICATIONS_QUEUE?: Queue<{ notificationId: string }>;
}

export interface AuthUser {
  id: string;
  organizationId: string;
  email: string;
  role: 'ADMIN' | 'HR' | 'SUPERVISOR' | 'COMMITTEE' | 'OPERATOR' | 'EMPLOYEE' | 'AUDITOR';
  employeeId?: string;
}

export type AppBindings = {
  Bindings: AppEnv;
  Variables: { user: AuthUser; correlationId: string };
};
