import type { z } from 'zod';
import type { AIProviderCapability } from './provider-registry.js';
import { AIProviderRegistry } from './provider-registry.js';

export type AIProfile = 'test' | 'local' | 'development' | 'staging' | 'production';
export type AITask =
  | 'INTAKE_EXTRACTION'
  | 'AUDIT_EXPLANATION'
  | 'COMMUNICATION_DRAFT'
  | 'SUPPORT_RESPONSE'
  | 'TRANSCRIPTION'
  | 'VISION_EXTRACTION';

export type AIRoutingPolicy = Partial<
  Record<AIProfile, Partial<Record<AITask, readonly string[]>>>
>;

export interface AIRoutedResult<T> {
  value: T;
  provider: string;
  model?: string;
  attempts: number;
  fallbackUsed: boolean;
  latencyMs: number;
}

export interface AIInferenceEvent {
  profile: AIProfile;
  task: AITask;
  provider: string;
  model?: string;
  success: boolean;
  attempt: number;
  fallbackUsed: boolean;
  latencyMs: number;
  errorCode?: string;
  createdAt: string;
}

export interface AIRouterOptions {
  maxAttempts?: number;
  onInference?: (event: AIInferenceEvent) => void | Promise<void>;
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined;
  const value = Number((error as { status?: unknown }).status);
  return Number.isFinite(value) ? value : undefined;
}

export function isRetryableAIError(error: unknown): boolean {
  const status = errorStatus(error);
  if (status === 429 || (status !== undefined && status >= 500)) return true;
  if (error instanceof TypeError) return true;
  const name = typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name?: unknown }).name)
    : '';
  if (name === 'AbortError' || name === 'ZodError') return true;
  const message = error instanceof Error ? error.message : String(error);
  return ['AI_TIMEOUT', 'AI_COMPAT_EMPTY_RESPONSE', 'AI_JSON_NOT_FOUND'].some((code) => message.includes(code));
}

function errorCode(error: unknown): string {
  const status = errorStatus(error);
  if (status !== undefined) return `HTTP_${status}`;
  if (error instanceof Error && error.name) return error.name;
  return 'AI_PROVIDER_ERROR';
}

export class YrakAIRouter {
  constructor(
    private readonly registry: AIProviderRegistry,
    private readonly policy: AIRoutingPolicy,
    private readonly options: AIRouterOptions = {},
  ) {}

  private candidates(profile: AIProfile, task: AITask, capability: AIProviderCapability): string[] {
    const ids = this.policy[profile]?.[task] ?? [];
    return [...new Set(ids)].filter((id) => this.registry.supports(id, capability));
  }

  private async emit(event: AIInferenceEvent): Promise<void> {
    await this.options.onInference?.(event);
  }

  private async run<T>(
    profile: AIProfile,
    task: AITask,
    capability: AIProviderCapability,
    operation: (providerId: string) => Promise<T>,
  ): Promise<AIRoutedResult<T>> {
    const candidates = this.candidates(profile, task, capability);
    if (!candidates.length) throw new Error(`AI_ROUTE_NOT_CONFIGURED:${profile}:${task}:${capability}`);

    const maxAttempts = Math.min(Math.max(this.options.maxAttempts ?? 2, 1), candidates.length);
    const overallStart = Date.now();
    let lastError: unknown;

    for (let index = 0; index < maxAttempts; index += 1) {
      const providerId = candidates[index]!;
      const registration = this.registry.require(providerId);
      const attemptStart = Date.now();
      try {
        const value = await operation(providerId);
        await this.emit({
          profile,
          task,
          provider: providerId,
          ...(registration.model ? { model: registration.model } : {}),
          success: true,
          attempt: index + 1,
          fallbackUsed: index > 0,
          latencyMs: Date.now() - attemptStart,
          createdAt: new Date().toISOString(),
        });
        return {
          value,
          provider: providerId,
          ...(registration.model ? { model: registration.model } : {}),
          attempts: index + 1,
          fallbackUsed: index > 0,
          latencyMs: Date.now() - overallStart,
        };
      } catch (error) {
        lastError = error;
        await this.emit({
          profile,
          task,
          provider: providerId,
          ...(registration.model ? { model: registration.model } : {}),
          success: false,
          attempt: index + 1,
          fallbackUsed: index > 0,
          latencyMs: Date.now() - attemptStart,
          errorCode: errorCode(error),
          createdAt: new Date().toISOString(),
        });
        if (!isRetryableAIError(error) || index === maxAttempts - 1) throw error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('AI_ROUTER_FAILED');
  }

  generate(profile: AIProfile, task: AITask, input: { system: string; prompt: string }) {
    return this.run(profile, task, 'generate', (id) => this.registry.require(id).provider.generate(input));
  }

  extract<T>(
    profile: AIProfile,
    task: AITask,
    input: { system: string; content: string },
    schema: z.ZodType<T>,
  ) {
    return this.run<T>(profile, task, 'extract', (id) => this.registry.require(id).provider.extract(input, schema));
  }

  transcribe(
    profile: AIProfile,
    input: { bytes: ArrayBuffer; mimeType: string; language?: string },
  ) {
    return this.run(profile, 'TRANSCRIPTION', 'transcribe', (id) => this.registry.require(id).provider.transcribe(input));
  }
}
