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
  const localText = compatible ? [compatible, workers] : [workers];
  const developmentText = compatible ? [compatible, workers] : [workers];
  const cloudText = compatible ? [workers, compatible] : [workers];

  return {
    test: {
      ...routesFor([mock]),
      TRANSCRIPTION: [mock],
    },
    local: {
      ...routesFor(localText),
      TRANSCRIPTION: [workers],
    },
    development: {
      ...routesFor(developmentText),
      TRANSCRIPTION: [workers],
    },
    staging: {
      ...routesFor(cloudText),
      TRANSCRIPTION: [workers],
    },
    production: {
      ...routesFor(cloudText),
      TRANSCRIPTION: [workers],
    },
  };
}
