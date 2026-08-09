import type { AIRoutingPolicy, AITask } from './ai-router.js';

const textTasks: AITask[] = [
  'INTAKE_EXTRACTION',
  'AUDIT_EXPLANATION',
  'COMMUNICATION_DRAFT',
  'SUPPORT_RESPONSE',
  'VISION_EXTRACTION',
];

function routesFor(providerIds: readonly string[]): Partial<Record<AITask, readonly string[]>> {
  return Object.fromEntries(textTasks.map((task) => [task, providerIds])) as Partial<
    Record<AITask, readonly string[]>
  >;
}

export interface DefaultRoutingPolicyOptions {
  workersProviderId?: string;
  compatibleProviderId?: string;
  anthropicProviderId?: string;
  mockProviderId?: string;
}

export function createDefaultRoutingPolicy(
  options: DefaultRoutingPolicyOptions = {},
): AIRoutingPolicy {
  const workers = options.workersProviderId ?? 'workers-ai';
  const compatible = options.compatibleProviderId;
  const anthropic = options.anthropicProviderId;
  const mock = options.mockProviderId ?? 'mock';
  // Anthropic (Sonnet) is the preferred quality provider when registered — it is only ever
  // selected if the caller actually registered it (e.g. ANTHROPIC_API_KEY is configured);
  // AIProviderRegistry.supports() silently filters out unregistered ids. workers-ai stays the
  // free, always-available fallback in every environment, including local dev.
  const order = [anthropic, compatible, workers].filter((id): id is string => Boolean(id));

  return {
    test: {
      ...routesFor([mock]),
      TRANSCRIPTION: [mock],
    },
    local: {
      ...routesFor(order),
      TRANSCRIPTION: order,
    },
    development: {
      ...routesFor(order),
      TRANSCRIPTION: order,
    },
    staging: {
      ...routesFor(order),
      TRANSCRIPTION: order,
    },
    production: {
      ...routesFor(order),
      TRANSCRIPTION: order,
    },
  };
}
