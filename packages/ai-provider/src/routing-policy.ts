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
  mockProviderId?: string;
}

export function createDefaultRoutingPolicy(
  options: DefaultRoutingPolicyOptions = {},
): AIRoutingPolicy {
  const workers = options.workersProviderId ?? 'workers-ai';
  const compatible = options.compatibleProviderId;
  const mock = options.mockProviderId ?? 'mock';
  const localOrder = compatible ? [compatible, workers] : [workers];
  const cloudOrder = compatible ? [workers, compatible] : [workers];

  return {
    test: {
      ...routesFor([mock]),
      TRANSCRIPTION: [mock],
    },
    local: {
      ...routesFor(localOrder),
      TRANSCRIPTION: localOrder,
    },
    development: {
      ...routesFor(localOrder),
      TRANSCRIPTION: localOrder,
    },
    staging: {
      ...routesFor(cloudOrder),
      TRANSCRIPTION: cloudOrder,
    },
    production: {
      ...routesFor(cloudOrder),
      TRANSCRIPTION: cloudOrder,
    },
  };
}
