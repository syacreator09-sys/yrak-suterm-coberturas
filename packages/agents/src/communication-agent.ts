export interface DecisionFacts {
  folio: string;
  processType: 'ROTATION' | 'COMPETITION';
  employeeName: string;
  baseLevel: string;
  targetLevel: string;
  startsAt: string;
  endsAt: string;
  reasons: readonly string[];
}

export class CommunicationAgent {
  public assignmentNotice(facts: DecisionFacts): string {
    return [
      `Folio: ${facts.folio}`,
      `Persona: ${facts.employeeName}`,
      `Nivel base: ${facts.baseLevel}`,
      `Nivel temporal: ${facts.targetLevel}`,
      `Periodo: ${facts.startsAt} al ${facts.endsAt}`,
      `Proceso: ${facts.processType === 'ROTATION' ? 'rotación' : 'concurso'}`,
      'Al concluir, la persona regresa a su nivel base.',
      ...facts.reasons.map((reason) => `Motivo: ${reason}`),
    ].join('\n');
  }
}
