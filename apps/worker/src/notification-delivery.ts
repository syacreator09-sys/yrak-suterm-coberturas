import type { Env } from './types.js';

interface Delivery {
  recipient: string;
  subject: string;
  text: string;
  templateKey: string;
}

interface AssignmentRow {
  folio: string;
  process_type: 'ROTATION' | 'COMPETITION';
  starts_at: string;
  ends_at: string;
  employee_name: string;
  email: string | null;
  base_level: string;
  target_level: string;
}

async function assignmentDeliveries(
  env: Env,
  coverageCaseId: string,
  topic: string,
): Promise<Delivery[]> {
  const result = await env.DB.prepare(
    `SELECT cc.folio, cc.process_type, cc.starts_at, cc.ends_at,
      e.name AS employee_name, e.email, base.name AS base_level, target.name AS target_level
    FROM temporary_assignments ta JOIN coverage_cases cc ON cc.id = ta.coverage_case_id
    JOIN employees e ON e.id = ta.employee_id
    JOIN levels base ON base.id = ta.base_level_id
    JOIN levels target ON target.id = ta.target_level_id
    WHERE cc.id = ? ORDER BY ta.chain_order`,
  )
    .bind(coverageCaseId)
    .all<AssignmentRow>();
  return (result.results ?? [])
    .filter((row): row is AssignmentRow & { email: string } => Boolean(row.email))
    .map((row) => {
      const heading =
        topic === 'COVERAGE_COMPLETED'
          ? 'Cobertura concluida'
          : topic === 'COVERAGE_STARTED'
            ? 'Cobertura iniciada'
            : topic === 'ASSIGNMENT_REJECTED'
              ? 'Asignación no autorizada'
              : 'Asignación temporal autorizada';
      const action =
        topic === 'COVERAGE_COMPLETED'
          ? `La cobertura concluyó y regresaste a ${row.base_level}.`
          : topic === 'COVERAGE_STARTED'
            ? `Inició tu cobertura temporal de ${row.target_level}.`
            : topic === 'ASSIGNMENT_REJECTED'
              ? 'La propuesta de asignación fue rechazada y no modifica tu posición base.'
              : `Cubrirás temporalmente ${row.target_level}. Al terminar regresarás a ${row.base_level}.`;
      return {
        recipient: row.email,
        subject: `${heading} · ${row.folio}`,
        templateKey: topic.toLowerCase(),
        text: [
          `Hola ${row.employee_name},`,
          '',
          action,
          `Periodo: ${row.starts_at} al ${row.ends_at}.`,
          `Proceso: ${row.process_type === 'ROTATION' ? 'rotación' : 'concurso'}.`,
          `Folio: ${row.folio}.`,
        ].join('\n'),
      };
    });
}

async function competitionOpenedDeliveries(env: Env, competitionId: string): Promise<Delivery[]> {
  const result = await env.DB.prepare(
    `SELECT c.id, c.registration_ends_at, c.exam_at,
      c.minimum_score, cc.folio, candidate.eligibility_status,
      candidate.eligibility_details_json, e.name, e.email
    FROM competitions c JOIN coverage_cases cc ON cc.id = c.coverage_case_id
    JOIN competition_candidates candidate ON candidate.competition_id = c.id
    JOIN employees e ON e.id = candidate.employee_id WHERE c.id = ?`,
  )
    .bind(competitionId)
    .all<{
      registration_ends_at: string;
      exam_at: string | null;
      minimum_score: number;
      folio: string;
      eligibility_status: string;
      eligibility_details_json: string;
      name: string;
      email: string | null;
    }>();
  return (result.results ?? [])
    .filter((row): row is typeof row & { email: string } => Boolean(row.email))
    .map((row) => {
      if (row.eligibility_status === 'ELIGIBLE') {
        return {
          recipient: row.email,
          subject: `Convocatoria de cobertura · ${row.folio}`,
          templateKey: 'competition_opened_eligible',
          text: [
            `Hola ${row.name},`,
            '',
            'Tu expediente cumple los requisitos para participar en el concurso.',
            `Fecha límite de aceptación: ${row.registration_ends_at}.`,
            `Fecha del examen: ${row.exam_at ?? 'por confirmar'}.`,
            `Calificación mínima: ${row.minimum_score}.`,
            `Folio: ${row.folio}.`,
          ].join('\n'),
        };
      }
      let reasons: string[] = [];
      try {
        const detail = JSON.parse(row.eligibility_details_json) as {
          reasons?: Array<{ code?: string }>;
        };
        reasons = (detail.reasons ?? []).map((reason) => reason.code ?? 'REQUISITO_NO_CUMPLIDO');
      } catch {
        reasons = ['EXPEDIENTE_NO_ELEGIBLE'];
      }
      return {
        recipient: row.email,
        subject: `Resultado de elegibilidad · ${row.folio}`,
        templateKey: 'competition_opened_ineligible',
        text: [
          `Hola ${row.name},`,
          '',
          'Tu expediente no aparece como elegible por los siguientes motivos:',
          ...reasons.map((reason) => `- ${reason}`),
          'Puedes solicitar la revisión de tus datos por el canal autorizado.',
        ].join('\n'),
      };
    });
}

async function competitionResultDeliveries(env: Env, competitionId: string): Promise<Delivery[]> {
  const result = await env.DB.prepare(
    `SELECT cc.folio, candidate.result_status, e.name, e.email
    FROM competitions c JOIN coverage_cases cc ON cc.id = c.coverage_case_id
    JOIN competition_candidates candidate ON candidate.competition_id = c.id
    JOIN employees e ON e.id = candidate.employee_id
    WHERE c.id = ? AND candidate.eligibility_status = 'ELIGIBLE'`,
  )
    .bind(competitionId)
    .all<{ folio: string; result_status: string; name: string; email: string | null }>();
  return (result.results ?? [])
    .filter((row): row is typeof row & { email: string } => Boolean(row.email))
    .map((row) => ({
      recipient: row.email,
      subject: `Resultado provisional · ${row.folio}`,
      templateKey: 'competition_result_provisional',
      text: [
        `Hola ${row.name},`,
        '',
        `Resultado registrado: ${row.result_status}.`,
        'El resultado es provisional hasta completar la aprobación y el periodo de revisión.',
        `Folio: ${row.folio}.`,
      ].join('\n'),
    }));
}

async function resolveDeliveries(
  env: Env,
  topic: string,
  aggregateId: string,
): Promise<Delivery[]> {
  if (topic === 'COMPETITION_OPENED') return competitionOpenedDeliveries(env, aggregateId);
  if (topic === 'COMPETITION_RESULT_PROVISIONAL') {
    return competitionResultDeliveries(env, aggregateId);
  }
  return assignmentDeliveries(env, aggregateId, topic);
}

async function sendDelivery(env: Env, outboxEventId: string, delivery: Delivery): Promise<void> {
  const existing = await env.DB.prepare(
    `SELECT id, status FROM messages
    WHERE outbox_event_id = ? AND recipient = ?`,
  )
    .bind(outboxEventId, delivery.recipient)
    .first<{ id: string; status: string }>();
  if (existing?.status === 'SENT' || existing?.status === 'DELIVERED') return;
  const messageId = existing?.id ?? crypto.randomUUID();
  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO messages (
      id, organization_id, channel, direction, recipient, subject, body_text,
      template_key, status, outbox_event_id
    ) SELECT ?, g.organization_id, 'EMAIL', 'OUTBOUND', ?, ?, ?, ?, 'QUEUED', ?
      FROM outbox_events oe
      LEFT JOIN coverage_cases cc ON oe.aggregate_type = 'COVERAGE_CASE' AND cc.id = oe.aggregate_id
      LEFT JOIN competitions c ON oe.aggregate_type = 'COMPETITION' AND c.id = oe.aggregate_id
      LEFT JOIN coverage_cases competition_case ON competition_case.id = c.coverage_case_id
      JOIN groups g ON g.id = COALESCE(cc.group_id, competition_case.group_id)
      WHERE oe.id = ?`,
    )
      .bind(
        messageId,
        delivery.recipient,
        delivery.subject,
        delivery.text,
        delivery.templateKey,
        outboxEventId,
        outboxEventId,
      )
      .run();
  } else {
    await env.DB.prepare("UPDATE messages SET status = 'QUEUED', error_code = NULL WHERE id = ?")
      .bind(messageId)
      .run();
  }
  try {
    await env.EMAIL.send({
      from: env.EMAIL_FROM,
      to: delivery.recipient,
      subject: delivery.subject,
      text: delivery.text,
    });
    await env.DB.prepare(
      "UPDATE messages SET status = 'SENT', sent_at = datetime('now') WHERE id = ?",
    )
      .bind(messageId)
      .run();
  } catch (error) {
    await env.DB.prepare("UPDATE messages SET status = 'FAILED', error_code = ? WHERE id = ?")
      .bind(error instanceof Error ? error.message.slice(0, 200) : 'EMAIL_SEND_FAILED', messageId)
      .run();
    throw error;
  }
}

export async function processOutboxEvent(env: Env, outboxEventId: string): Promise<void> {
  const event = await env.DB.prepare(
    `SELECT id, topic, aggregate_id, status
    FROM outbox_events WHERE id = ?`,
  )
    .bind(outboxEventId)
    .first<{ id: string; topic: string; aggregate_id: string; status: string }>();
  if (!event || event.status === 'SENT') return;
  const claim = await env.DB.prepare(
    `UPDATE outbox_events
    SET status = 'PROCESSING', attempts = attempts + 1
    WHERE id = ? AND status IN ('PENDING','FAILED')`,
  )
    .bind(outboxEventId)
    .run();
  const changes = Number((claim.meta as { changes?: number } | undefined)?.changes ?? 0);
  if (changes === 0) return;
  try {
    const deliveries = await resolveDeliveries(env, event.topic, event.aggregate_id);
    for (const delivery of deliveries) await sendDelivery(env, event.id, delivery);
    await env.DB.prepare(
      "UPDATE outbox_events SET status = 'SENT', processed_at = datetime('now') WHERE id = ?",
    )
      .bind(event.id)
      .run();
  } catch (error) {
    await env.DB.prepare(
      `UPDATE outbox_events
      SET status = 'FAILED', available_at = datetime('now', '+5 minutes') WHERE id = ?`,
    )
      .bind(event.id)
      .run();
    throw error;
  }
}
