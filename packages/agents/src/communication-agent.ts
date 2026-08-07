import type { AIProvider } from '@yrak/ai-provider';

export class CommunicationAgent {
  constructor(private readonly provider: AIProvider) {}
  async draft(input: { facts: Record<string, unknown>; purpose: string }): Promise<string> {
    return this.provider.generate({ system: 'Redacta comunicaciones administrativas claras. No cambies hechos, resultados ni reglas proporcionadas.', prompt: `Propósito: ${input.purpose}\nHechos: ${JSON.stringify(input.facts)}` });
  }
}
