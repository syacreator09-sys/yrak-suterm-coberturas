import type { AIProvider } from '@yrak/ai-provider';
import { z } from 'zod';

export const IntakeDraftSchema = z.object({
  groupId: z.string().nullable(),
  absentEmployeeId: z.string().nullable(),
  vacantLevelNumber: z.number().int().nullable(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  reason: z.string().nullable(),
  source: z.enum(['EMAIL', 'AUDIO', 'IMAGE', 'DOCUMENT', 'MANUAL']),
  confidence: z.number().min(0).max(1),
  missingFields: z.array(z.string()),
  notes: z.array(z.string()),
  reviewRequired: z.literal(true),
});

export type IntakeDraft = z.infer<typeof IntakeDraftSchema>;

const extractionInstructions = `
Eres el agente de captura de YRAK Coberturas. Extrae datos de una solicitud laboral sin inventar.
Reglas:
- Un nivel inferior puede cubrir temporalmente al inmediato superior.
- No decidas candidato, ganador, elegibilidad ni aprobación.
- Usa null cuando un dato no esté explícito.
- Fechas completas en ISO 8601 cuando sean inequívocas; de lo contrario usa null.
- reviewRequired siempre debe ser true.
- missingFields debe listar datos necesarios no encontrados.
- confidence representa únicamente la confianza de extracción, no la validez de la solicitud.
`;

export class IntakeAgent {
  public constructor(private readonly provider: AIProvider) {}

  public async fromText(content: string, source: IntakeDraft['source']): Promise<IntakeDraft> {
    return this.provider.extract(
      { prompt: `${extractionInstructions}\nLa fuente es ${source}.`, content },
      IntakeDraftSchema,
    );
  }

  public async fromImage(
    bytes: ArrayBuffer,
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
  ): Promise<IntakeDraft> {
    return this.provider.analyzeImage(
      { bytes, mimeType, prompt: `${extractionInstructions}\nLa fuente es IMAGE.` },
      IntakeDraftSchema,
    );
  }
}
