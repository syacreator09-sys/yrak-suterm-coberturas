export type NotificationTemplateKey =
  | 'SHORT_COVERAGE_ASSIGNED'
  | 'COMPETITION_INVITATION'
  | 'INELIGIBLE_NOTICE'
  | 'EXAM_REMINDER'
  | 'COMPETITION_RESULT'
  | 'ASSIGNMENT_STARTED'
  | 'RETURN_TO_BASE'
  | 'MISSING_INFORMATION'
  | 'ROTATION_OFFER';

export interface RenderedMessage { subject: string; text: string; html?: string }

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

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
    case 'ROTATION_OFFER': {
      const titular = data.titularAusente ?? `Nivel ${data.targetLevel ?? ''}`;
      const minutes = data.expiresInMinutes ?? '';
      const acceptUrl = String(data.acceptUrl ?? '');
      const rejectUrl = String(data.rejectUrl ?? '');
      const text = `${name}, tiene una oferta de cobertura para cubrir a ${titular} en el nivel ${data.targetLevel ?? ''} del ${data.startDate ?? ''} al ${data.endDate ?? ''}. Tiene ${minutes} minutos para responder. Aceptar: ${acceptUrl} · Rechazar: ${rejectUrl}`;
      const html = `<div style="font-family:sans-serif;max-width:480px">
<h2>Oferta de cobertura</h2>
<p>${escapeHtml(name)}, tiene una oferta para cubrir a <strong>${escapeHtml(String(titular))}</strong> en el nivel <strong>${escapeHtml(String(data.targetLevel ?? ''))}</strong>.</p>
<p>Del <strong>${escapeHtml(String(data.startDate ?? ''))}</strong> al <strong>${escapeHtml(String(data.endDate ?? ''))}</strong>.</p>
<p>Tiene <strong>${escapeHtml(String(minutes))} minutos</strong> para responder antes de que se ofrezca al siguiente candidato.</p>
<p>
  <a href="${acceptUrl}" style="display:inline-block;padding:10px 18px;margin-right:10px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Aceptar</a>
  <a href="${rejectUrl}" style="display:inline-block;padding:10px 18px;background:#b91c1c;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Rechazar</a>
</p>
</div>`;
      return { subject: `Oferta de cobertura - nivel ${data.targetLevel ?? ''}`, text, html };
    }
  }
}
