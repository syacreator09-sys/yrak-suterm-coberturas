import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

interface Env {
  DB: D1Database;
  MCP_API_TOKEN: string;
  MCP_ORGANIZATION_ID: string;
}

const idSchema = z.string().min(1).max(160);
const entityTypeSchema = z.string().min(1).max(80);

async function log(env: Env, tool: string, args: unknown) {
  await env.DB.prepare(`INSERT INTO mcp_access_log(id,organization_id,tool_name,arguments_json) VALUES(?,?,?,?)`)
    .bind(crypto.randomUUID(), env.MCP_ORGANIZATION_ID, tool, JSON.stringify(args))
    .run();
}

function createServer(env: Env) {
  const server = new McpServer({ name: 'yrak-suterm-coberturas', version: '0.1.0' }, { capabilities: { tools: {} } });

  server.registerTool('get_coverage_case', {
    description: 'Consulta un expediente. Solo lectura.',
    inputSchema: z.object({ caseId: idSchema }),
  }, async ({ caseId }) => {
    await log(env, 'get_coverage_case', { caseId });
    const row = await env.DB.prepare(`SELECT id,group_id,target_level_id,starts_on,ends_on,effective_days,
        process_type,status,parent_coverage_case_id,root_coverage_case_id,chain_order,created_at,updated_at
      FROM coverage_cases WHERE id=? AND organization_id=?`)
      .bind(caseId, env.MCP_ORGANIZATION_ID)
      .first();
    return { content: [{ type: 'text', text: JSON.stringify(row ?? { error: 'NOT_FOUND' }) }] };
  });

  server.registerTool('list_rotation_queue', {
    description: 'Consulta fila de rotación. Solo lectura.',
    inputSchema: z.object({ groupId: idSchema, sourceLevelId: idSchema, targetLevelId: idSchema }),
  }, async (args) => {
    await log(env, 'list_rotation_queue', args);
    const rows = await env.DB.prepare(`SELECT e.employee_number,e.name,q.queue_position,q.status
      FROM rotation_pools p
      JOIN rotation_queue_entries q ON q.pool_id=p.id
      JOIN employees e ON e.id=q.employee_id
      WHERE p.organization_id=? AND p.group_id=? AND p.source_level_id=? AND p.target_level_id=?
      ORDER BY q.queue_position`)
      .bind(env.MCP_ORGANIZATION_ID, args.groupId, args.sourceLevelId, args.targetLevelId)
      .all();
    return { content: [{ type: 'text', text: JSON.stringify(rows.results ?? []) }] };
  });

  server.registerTool('get_employee_requirements', {
    description: 'Consulta requisitos de trabajador. Solo lectura.',
    inputSchema: z.object({ employeeId: idSchema }),
  }, async ({ employeeId }) => {
    await log(env, 'get_employee_requirements', { employeeId });
    const rows = await env.DB.prepare(`SELECT r.name,r.requirement_type,er.status,er.valid_until,er.score
      FROM employee_requirements er
      JOIN requirements r ON r.id=er.requirement_id
      JOIN employees e ON e.id=er.employee_id
      WHERE er.employee_id=? AND e.organization_id=? ORDER BY r.name`)
      .bind(employeeId, env.MCP_ORGANIZATION_ID)
      .all();
    return { content: [{ type: 'text', text: JSON.stringify(rows.results ?? []) }] };
  });

  server.registerTool('get_audit_events', {
    description: 'Consulta auditoría inmutable. Solo lectura.',
    inputSchema: z.object({ entityType: entityTypeSchema, entityId: idSchema }),
  }, async (args) => {
    await log(env, 'get_audit_events', args);
    const rows = await env.DB.prepare(`SELECT actor_id,actor_role,action,previous_value_json,new_value_json,
        rule_applied,reason,created_at
      FROM audit_events
      WHERE organization_id=? AND entity_type=? AND entity_id=? ORDER BY created_at,id`)
      .bind(env.MCP_ORGANIZATION_ID, args.entityType, args.entityId)
      .all();
    return { content: [{ type: 'text', text: JSON.stringify(rows.results ?? []) }] };
  });

  return server;
}

function configured(env: Env): boolean {
  return Boolean(
    env.MCP_API_TOKEN &&
    env.MCP_API_TOKEN !== 'local-mcp-change-me' &&
    env.MCP_ORGANIZATION_ID &&
    !env.MCP_ORGANIZATION_ID.startsWith('REPLACE_'),
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true, service: 'yrak-suterm-mcp', mode: 'read-only' });
    }
    if (request.method === 'GET' && url.pathname === '/ready') {
      const organizationConfigured = Boolean(env.MCP_ORGANIZATION_ID && !env.MCP_ORGANIZATION_ID.startsWith('REPLACE_'));
      const tokenConfigured = Boolean(env.MCP_API_TOKEN);
      if (!organizationConfigured || !tokenConfigured) {
        return Response.json({ ok: false, service: 'yrak-suterm-mcp', database: 'unknown', organizationConfigured, tokenConfigured }, { status: 503 });
      }
      try {
        await env.DB.prepare('SELECT 1 AS ok').first();
        return Response.json({ ok: true, service: 'yrak-suterm-mcp', database: 'healthy', organizationConfigured: true, tokenConfigured: true });
      } catch {
        return Response.json({ ok: false, service: 'yrak-suterm-mcp', database: 'down', organizationConfigured: true, tokenConfigured: true }, { status: 503 });
      }
    }

    const auth = request.headers.get('authorization');
    if (!env.MCP_API_TOKEN || auth !== `Bearer ${env.MCP_API_TOKEN}`) return new Response('Unauthorized', { status: 401 });
    if (!env.MCP_ORGANIZATION_ID || env.MCP_ORGANIZATION_ID.startsWith('REPLACE_')) {
      return new Response('MCP organization not configured', { status: 503 });
    }
    return createMcpHandler(() => createServer(env))(request);
  },
} satisfies ExportedHandler<Env>;
