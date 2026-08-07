import type { GroupCoordinator } from './group-coordinator.js';

export interface WorkflowBindingLike<T> {
  create(options: { id?: string; params: T }): Promise<{ id: string }>;
}

export interface AppEnv {
  APP_ENV: 'development' | 'staging' | 'production';
  DEFAULT_TIMEZONE: string;
  DB: D1Database;
  EVIDENCE_BUCKET?: R2Bucket;
  AI?: Ai;
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
