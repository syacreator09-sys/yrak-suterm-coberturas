import type { AIProvider } from '@yrak/ai-provider';

export interface AuditFactSource { readDecisionFacts(entityId: string): Promise<Record<string, unknown>> }

export class AuditAgent {
  constructor(private readonly provider: AIProvider, private readonly source: AuditFactSource) {}
  async explain(entityId: string): Promise<string> {
    const facts = await this.source.readDecisionFacts(entityId);
    return this.provider.generate({ system: 'Explica únicamente los hechos de auditoría entregados. No inventes reglas ni razones.', prompt: JSON.stringify(facts) });
  }
}
