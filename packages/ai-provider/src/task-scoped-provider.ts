import type { z } from 'zod';
import type { AIProvider } from './provider.js';
import type { AIProfile, AITask } from './ai-router.js';
import { YrakAIRouter } from './ai-router.js';

export class TaskScopedAIProvider implements AIProvider {
  constructor(
    private readonly router: YrakAIRouter,
    private readonly profile: AIProfile,
    private readonly task: AITask,
  ) {}

  async generate(input: { system: string; prompt: string }): Promise<string> {
    return (await this.router.generate(this.profile, this.task, input)).value;
  }

  async extract<T>(
    input: { system: string; content: string },
    schema: z.ZodType<T>,
  ): Promise<T> {
    return (await this.router.extract(this.profile, this.task, input, schema)).value;
  }

  async transcribe(input: { bytes: ArrayBuffer; mimeType: string; language?: string }) {
    return (await this.router.transcribe(this.profile, input)).value;
  }
}
