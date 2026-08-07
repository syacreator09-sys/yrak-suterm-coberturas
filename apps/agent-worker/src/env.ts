import type { YrakAgentSession } from './session.js';

export interface Env {
  DB: D1Database;
  AI: Ai;
  AGENT_SESSION: DurableObjectNamespace<YrakAgentSession>;
  AGENT_API_TOKEN: string;
  AGENT_ORGANIZATION_ID: string;
  WORKERS_AI_TEXT_MODEL?: string;
}
