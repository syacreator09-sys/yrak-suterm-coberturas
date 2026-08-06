export class SupportAgent {
  public answerRuleQuestion(question: string): string {
    const normalized = question.toLowerCase();
    if (normalized.includes('1') && normalized.includes('5')) {
      return 'Las coberturas de 1 a 5 días inclusive se asignan por rotación, sin examen de concurso.';
    }
    if (normalized.includes('6') || normalized.includes('examen')) {
      return 'Las coberturas de 6 días o más requieren cumplir requisitos y participar en un examen de concurso.';
    }
    if (normalized.includes('nivel') || normalized.includes('regresa')) {
      return 'La cobertura es temporal: el nivel base no se modifica y la persona regresa a él al finalizar.';
    }
    return 'La consulta requiere revisar el expediente o la versión vigente de las reglas.';
  }
}
