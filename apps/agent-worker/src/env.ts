import type { YrakAgentSession } from './session.js';

export interface Env {
  DB: D1Database;
  AI: Ai;
  AGENT_SESSION: DurableObjectNamespace<YrakAgentSession>;
  AGENT_API_TOKEN: string;
  AGENT_ORGANIZATION_ID: string;
  WORKERS_AI_TEXT_MODEL?: string;
  WORKERS_AI_TRANSCRIPTION_MODEL?: string;
  AI_PROFILE?: 'local' | 'development' | 'staging' | 'production';
  AI_MAX_PROVIDER_ATTEMPTS?: string;
  AI_REQUEST_TIMEOUT_MS?: string;
  AI_COMPAT_PROVIDER_ID?: string;
  AI_COMPAT_BASE_URL?: string;
  AI_COMPAT_API_KEY?: string;
  AI_COMPAT_TEXT_MODEL?: string;
  AI_COMPAT_TRANSCRIPTION_MODEL?: string;
}
