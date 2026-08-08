import type { GroupCoordinator } from './group-coordinator.js';

export interface WorkflowBindingLike<T> {
  create(options: { id?: string; params: T }): Promise<{ id: string }>;
}

export interface SendEmailLike {
  send(message: {
    from: string | { email: string; name?: string };
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
  }): Promise<{ messageId?: string }>;
}

export interface AppEnv {
  APP_ENV: 'development' | 'staging' | 'production';
  DEFAULT_TIMEZONE: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  EMAIL_FROM?: string;
  INBOUND_EMAIL_ORGANIZATION_ID?: string;
  BOOTSTRAP_ENABLED?: string;
  BOOTSTRAP_TOKEN?: string;

  AI_PROVIDER?: 'workers-ai' | 'openai' | 'anthropic' | 'compatible';
  OPENAI_API_KEY?: string;
  OPENAI_TEXT_MODEL?: string;
  OPENAI_TRANSCRIPTION_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_TEXT_MODEL?: string;
  WORKERS_AI_TEXT_MODEL?: string;
  WORKERS_AI_TRANSCRIPTION_MODEL?: string;
  AI_COMPAT_PROVIDER_ID?: string;
  AI_COMPAT_BASE_URL?: string;
  AI_COMPAT_API_KEY?: string;
  AI_COMPAT_TEXT_MODEL?: string;
  AI_COMPAT_TRANSCRIPTION_MODEL?: string;
  AI_REQUEST_TIMEOUT_MS?: string;

  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_RAG_RPC?: string;
  RAG_EMBEDDING_BASE_URL?: string;
  RAG_EMBEDDING_API_KEY?: string;
  RAG_EMBEDDING_MODEL?: string;
  RAG_REQUEST_TIMEOUT_MS?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  MODAL_ENDPOINT_URL?: string;
  MODAL_API_TOKEN?: string;
  HUGGINGFACE_TOKEN?: string;
  GMAIL_TEST_ADDRESS?: string;

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
