import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from './types.js';

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function requireIdempotency(operation: string): MiddlewareHandler<AppBindings> {
  return async (context, next) => {
    const key = context.req.header('idempotency-key');
    if (!key || key.length < 8 || key.length > 200) {
      return context.json({ error: 'IDEMPOTENCY_KEY_REQUIRED' }, 400);
    }
    const user = context.get('user');
    const requestText = await context.req.raw.clone().text();
    const requestHash = await sha256(
      `${context.req.method}:${context.req.path}:${requestText}`,
    );
    const existing = await context.env.DB.prepare(`SELECT request_hash, response_json,
        status_code, expires_at
      FROM idempotency_keys
      WHERE organization_id = ? AND operation = ? AND idempotency_key = ?`)
      .bind(user.organizationId, operation, key)
      .first<{
        request_hash: string;
        response_json: string | null;
        status_code: number | null;
        expires_at: string;
      }>();
    if (existing) {
      if (existing.request_hash !== requestHash) {
        return context.json({ error: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' }, 409);
      }
      if (existing.response_json !== null && existing.status_code !== null) {
        return new Response(existing.response_json, {
          status: existing.status_code,
          headers: {
            'content-type': 'application/json; charset=UTF-8',
            'x-idempotent-replay': 'true',
          },
        });
      }
      return context.json({ error: 'IDEMPOTENCY_REQUEST_IN_PROGRESS' }, 409);
    }

    const claimId = crypto.randomUUID();
    try {
      await context.env.DB.prepare(`INSERT INTO idempotency_keys (
        id, organization_id, operation, idempotency_key, request_hash, expires_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now', '+24 hours'))`)
        .bind(claimId, user.organizationId, operation, key, requestHash)
        .run();
    } catch {
      return context.json({ error: 'IDEMPOTENCY_REQUEST_IN_PROGRESS' }, 409);
    }

    try {
      await next();
      const statusCode = context.res.status;
      if (statusCode < 500) {
        const responseText = await context.res.clone().text();
        await context.env.DB.prepare(`UPDATE idempotency_keys
          SET response_json = ?, status_code = ? WHERE id = ?`)
          .bind(responseText, statusCode, claimId)
          .run();
      } else {
        await context.env.DB.prepare('DELETE FROM idempotency_keys WHERE id = ?')
          .bind(claimId)
          .run();
      }
    } catch (error) {
      await context.env.DB.prepare('DELETE FROM idempotency_keys WHERE id = ?')
        .bind(claimId)
        .run();
      throw error;
    }
  };
}
