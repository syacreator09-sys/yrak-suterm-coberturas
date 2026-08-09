import { z } from 'zod';
import type { AIProvider } from '@yrak/ai-provider';

export const IntakeDraftSchema = z.object({
  group: z.string().nullable(),
  targetLevel: z.number().int().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  reason: z.string().nullable(),
  employeeReference: z.string().nullable().optional(),
});
export type IntakeDraft = z.infer<typeof IntakeDraftSchema>;

export class IntakeAgent {
  constructor(private readonly provider: AIProvider) {}
  async extractFromText(content: string): Promise<IntakeDraft> {
    return this.provider.extract({
      system: 'Extrae únicamente datos explícitos para crear un BORRADOR de cobertura. No selecciones candidatos ni tomes decisiones laborales. '
        + 'Devuelve un objeto JSON con EXACTAMENTE estas claves en inglés, sin traducirlas ni agregar otras: '
        + '"group" (string|null), "targetLevel" (integer|null), "startDate" (string ISO|null), "endDate" (string ISO|null), '
        + '"reason" (string|null), "employeeReference" (string|null). Usa null si falta un dato — nunca omitas una clave.',
      content,
    }, IntakeDraftSchema);
  }
}
