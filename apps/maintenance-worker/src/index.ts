interface Env {
  DB: D1Database;
  NOTIFICATIONS_QUEUE: Queue<{ notificationId: string }>;
}

async function recoverStaleNotificationClaims(env: Env) {
  const result = await env.DB.prepare(`UPDATE notifications
       SET status='FAILED',last_error='PROCESSING_TIMEOUT',processing_started_at=NULL
     WHERE status='PROCESSING'
       AND processing_started_at IS NOT NULL
       AND processing_started_at <= datetime('now','-10 minutes')`)
    .run();
  return result.meta.changes ?? 0;
}

async function recoverNotifications(env: Env) {
  const rows = await env.DB.prepare(`SELECT id
      FROM notifications
     WHERE status IN ('PENDING','FAILED')
       AND attempts < 5
       AND created_at <= datetime('now','-2 minutes')
     ORDER BY created_at
     LIMIT 200`)
    .all<{ id: string }>();

  for (const row of rows.results ?? []) {
    await env.NOTIFICATIONS_QUEUE.send({ notificationId: row.id });
  }
  return (rows.results ?? []).length;
}

async function expireRequirements(env: Env) {
  const result = await env.DB.prepare(`UPDATE employee_requirements
       SET status='EXPIRED',version=version+1,updated_at=datetime('now')
     WHERE status='COMPLIANT'
       AND valid_until IS NOT NULL
       AND valid_until < date('now')`)
    .run();
  return result.meta.changes ?? 0;
}

async function releaseOrphanedD1Reservations(env: Env) {
  const result = await env.DB.prepare(`UPDATE rotation_queue_entries
       SET status='AVAILABLE',version=version+1,updated_at=datetime('now')
     WHERE status='RESERVED'
       AND NOT EXISTS(
         SELECT 1
           FROM temporary_assignments a
           JOIN rotation_pools p ON p.id=rotation_queue_entries.pool_id
           JOIN coverage_cases c ON c.id=a.coverage_case_id
          WHERE a.employee_id=rotation_queue_entries.employee_id
            AND c.group_id=p.group_id
            AND a.base_level_id=p.source_level_id
            AND a.target_level_id=p.target_level_id
            AND a.status IN('PROPOSED','APPROVED','SCHEDULED','ACTIVE')
       )`)
    .run();
  return result.meta.changes ?? 0;
}

async function maintenance(env: Env) {
  const recoveredNotificationClaims = await recoverStaleNotificationClaims(env);
  const [expiredRequirements, releasedReservations, requeuedNotifications] = await Promise.all([
    expireRequirements(env),
    releaseOrphanedD1Reservations(env),
    recoverNotifications(env),
  ]);
  return {
    recoveredNotificationClaims,
    expiredRequirements,
    releasedReservations,
    requeuedNotifications,
  };
}

const handler: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true, service: 'yrak-suterm-maintenance' });
    }
    if (request.method === 'GET' && url.pathname === '/ready') {
      try {
        await env.DB.prepare('SELECT 1 AS ok').first();
        return Response.json({ ok: true, service: 'yrak-suterm-maintenance', database: 'healthy' });
      } catch {
        return Response.json({ ok: false, service: 'yrak-suterm-maintenance', database: 'down' }, { status: 503 });
      }
    }
    return new Response('Not Found', { status: 404 });
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      maintenance(env).then((result) => console.log('maintenance', JSON.stringify(result))),
    );
  },
};

export default handler;
