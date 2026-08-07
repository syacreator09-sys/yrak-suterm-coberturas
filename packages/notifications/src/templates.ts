export type NotificationTemplateKey =
  | 'SHORT_COVERAGE_ASSIGNED'
  | 'COMPETITION_INVITATION'
  | 'INELIGIBLE_NOTICE'
  | 'EXAM_REMINDER'
  | 'COMPETITION_RESULT'
  | 'ASSIGNMENT_STARTED'
  | 'RETURN_TO_BASE'
  | 'MISSING_INFORMATION';

export interface RenderedMessage { subject: string; text: string }

export function renderTemplate(key: NotificationTemplateKey, data: Record<string, string | number | null | undefined>): RenderedMessage {
  const name = String(data.name ?? 'Participante');
  switch (key) {
    case 'SHORT_COVERAGE_ASSIGNED':
      return { subject: `Asignación temporal - nivel ${data.targetLevel ?? ''}`, text: `${name}, ha sido seleccionado conforme a la rotación vigente para cubrir temporalmente el nivel ${data.targetLevel ?? ''} del ${data.startDate ?? ''} al ${data.endDate ?? ''}. Su nivel base permanece en ${data.baseLevel ?? ''}.` };
    case 'COMPETITION_INVITATION':
      return { subject: `Convocatoria de cobertura - nivel ${data.targetLevel ?? ''}`, text: `${name}, usted cumple los requisitos registrados para participar en la cobertura del nivel ${data.targetLevel ?? ''}. Consulte fechas, examen y reglas del expediente ${data.folio ?? ''}.` };
    case 'INELIGIBLE_NOTICE':
      return { subject: 'Estado de elegibilidad', text: `${name}, no aparece como elegible para esta convocatoria. Motivo registrado: ${data.reason ?? 'requisito pendiente'}.` };
    case 'EXAM_REMINDER':
      return { subject: 'Recordatorio de examen', text: `${name}, recordatorio del examen asociado al expediente ${data.folio ?? ''}: ${data.examDate ?? ''}.` };
    case 'COMPETITION_RESULT':
      return { subject: 'Resultado de concurso', text: `${name}, el resultado publicado para el expediente ${data.folio ?? ''} es: ${data.result ?? ''}.` };
    case 'ASSIGNMENT_STARTED':
      return { subject: 'Inicio de cobertura temporal', text: `${name}, inicia su cobertura temporal del nivel ${data.targetLevel ?? ''}. Su nivel base no cambia.` };
    case 'RETURN_TO_BASE':
      return { subject: 'Cierre de cobertura temporal', text: `${name}, la cobertura ha concluido. Operativamente regresa a su nivel base ${data.baseLevel ?? ''}.` };
    case 'MISSING_INFORMATION':
      return { subject: 'Información requerida', text: `Falta información para continuar el expediente ${data.folio ?? ''}: ${data.missing ?? ''}.` };
  }
}
