export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailPayload {
  from: EmailAddress | string;
  to: EmailAddress | string | Array<EmailAddress | string>;
  subject: string;
  text: string;
  html?: string;
  replyTo?: EmailAddress | string;
}

export interface EmailBindingLike {
  send(payload: EmailPayload): Promise<unknown>;
}

export interface CoverageEmailData {
  employeeName: string;
  baseLevel: string;
  targetLevel: string;
  startsAt: string;
  endsAt: string;
  folio: string;
}

export function shortCoverageAssignmentTemplate(data: CoverageEmailData): EmailPayload {
  const subject = `Asignación temporal ${data.folio}: ${data.targetLevel}`;
  const text = [
    `Hola ${data.employeeName},`,
    '',
    `Fuiste seleccionado conforme a la fila rotativa para cubrir temporalmente ${data.targetLevel}.`,
    `Nivel base: ${data.baseLevel}.`,
    `Periodo: ${data.startsAt} al ${data.endsAt}.`,
    'Al finalizar regresarás automáticamente a tu nivel base.',
  ].join('\n');
  return { from: '', to: '', subject, text };
}

export function ineligibleTemplate(input: {
  employeeName: string;
  folio: string;
  reasons: readonly string[];
}): EmailPayload {
  return {
    from: '',
    to: '',
    subject: `Resultado de elegibilidad ${input.folio}`,
    text: [
      `Hola ${input.employeeName},`,
      '',
      'No apareces como elegible por los siguientes motivos:',
      ...input.reasons.map((reason) => `- ${reason}`),
      '',
      'Puedes solicitar revisión de tu expediente por el canal autorizado.',
    ].join('\n'),
  };
}
