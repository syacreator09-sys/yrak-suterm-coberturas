import type { GroupCoordinator } from './durable/group-coordinator.js';

export interface AttachmentProcessingMessage {
  kind: 'ATTACHMENT';
  attachmentId: string;
  r2Key: string;
  mimeType: string;
  organizationId: string;
}

export interface OutboxProcessingMessage {
  kind: 'OUTBOX';
  outboxEventId: string;
}

export type ProcessingMessage = AttachmentProcessingMessage | OutboxProcessingMessage;

export interface EmailSenderBinding {
  send(payload: {
    from: string | { email: string; name?: string };
    to: string | { email: string; name?: string } | Array<string | { email: string; name?: string }>;
    subject: string;
    text: string;
    html?: string;
  }): Promise<unknown>;
}

export interface WorkflowBindingLike {
  create(options: { id?: string; params?: unknown }): Promise<{ id: string }>;
  get(id: string): Promise<{
    status(): Promise<unknown>;
    sendEvent(options: { type: string; payload?: unknown }): Promise<void>;
  }>;
}

export interface Env {
  DB: D1Database;
  EVIDENCE: R2Bucket;
  PROCESSING_QUEUE: Queue<ProcessingMessage>;
  GROUP_COORDINATOR: DurableObjectNamespace<GroupCoordinator>;
  COVERAGE_WORKFLOW: WorkflowBindingLike;
  AI: Ai;
  EMAIL: EmailSenderBinding;
  ENVIRONMENT: 'development' | 'test' | 'staging' | 'production';
  APP_ORIGIN: string;
  EMAIL_FROM: string;
  BOOTSTRAP_TOKEN?: string;
  GENERATIVE_PROVIDER?: 'openai';
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
}

export interface AuthenticatedUser {
  id: string;
  employeeId: string | null;
  organizationId: string;
  email: string;
  displayName: string;
  roles: readonly string[];
  groups: readonly string[];
}

export type AppBindings = {
  Bindings: Env;
  Variables: {
    user: AuthenticatedUser;
    correlationId: string;
  };
};
