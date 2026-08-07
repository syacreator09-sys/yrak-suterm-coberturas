import type { AIProvider } from './provider.js';

export type AIProviderCapability = 'generate' | 'extract' | 'transcribe' | 'vision';

export interface AIProviderRegistration {
  id: string;
  provider: AIProvider;
  model?: string;
  capabilities: readonly AIProviderCapability[];
}

export class AIProviderRegistry {
  private readonly providers = new Map<string, AIProviderRegistration>();

  register(registration: AIProviderRegistration): this {
    if (this.providers.has(registration.id)) {
      throw new Error(`AI_PROVIDER_DUPLICATE:${registration.id}`);
    }
    this.providers.set(registration.id, registration);
    return this;
  }

  get(id: string): AIProviderRegistration | undefined {
    return this.providers.get(id);
  }

  require(id: string): AIProviderRegistration {
    const registration = this.get(id);
    if (!registration) throw new Error(`AI_PROVIDER_NOT_REGISTERED:${id}`);
    return registration;
  }

  supports(id: string, capability: AIProviderCapability): boolean {
    return this.get(id)?.capabilities.includes(capability) ?? false;
  }

  list(): AIProviderRegistration[] {
    return [...this.providers.values()];
  }
}
