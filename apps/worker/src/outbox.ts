import type { Env, OutboxProcessingMessage } from './types.js';

export type OutboxTopic =
  | 'ASSIGNMENT_APPROVED'
  | 'ASSIGNMENT_REJECTED'
  | 'COMPETITION_OPENED'
  | 'COMPETITION_RESULT_PROVISIONAL'
  | 'COVERAGE_STARTED'
  | 'COVERAGE_COMPLETED';

export async function enqueueOutbox(
  env: Env,
  topic: OutboxTopic,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown> = {},
): Promise<string> {
  const id = crypto.randomUUID();
  await env.DB.prepare(`INSERT INTO outbox_events (
    id, topic, aggregate_type, aggregate_id, payload_json, status, available_at
  ) VALUES (?, ?, ?, ?, ?, 'PENDING', datetime('now'))`)
    .bind(id, topic, aggregateType, aggregateId, JSON.stringify(payload))
    .run();
  const message: OutboxProcessingMessage = { kind: 'OUTBOX', outboxEventId: id };
  await env.PROCESSING_QUEUE.send(message);
  return id;
}

export async function sweepOutbox(env: Env): Promise<number> {
  const result = await env.DB.prepare(`SELECT id FROM outbox_events
    WHERE status IN ('PENDING','FAILED') AND available_at <= datetime('now')
    ORDER BY created_at LIMIT 50`)
    .all<{ id: string }>();
  const events = result.results ?? [];
  if (events.length > 0) {
    await env.PROCESSING_QUEUE.sendBatch(
      events.map((event) => ({ body: { kind: 'OUTBOX' as const, outboxEventId: event.id } })),
    );
  }
  return events.length;
}
