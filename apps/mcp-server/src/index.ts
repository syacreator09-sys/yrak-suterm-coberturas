import { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'agents/mcp/server';
import * as z from 'zod/v4';

interface Env { DB: D1Database; MCP_SERVICE_TOKEN: string; MCP_ORGANIZATION_ID: string; MCP_ALLOWED_HOSTNAME?: string }
function text(value: unknown) { return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] }; }
function notFound(entity: string) { return text({ error: 'NOT_FOUND', entity }); }

function createServer(env: Env): McpServer {
  const server = new McpServer({ name: 'yrak-suterm-coberturas', version: '0.1.0' }, { instructions: 'Herramientas de consulta de solo lectura. Nunca infieras ganadores ni modifiques asignaciones.' });
  server.registerTool('list_coverages', { description: 'Lista expedientes de la organización.', inputSchema: z.object({ status: z.string().optional(), limit: z.number().int().min(1).max(100).default(25) }) }, async ({ status, limit }) => {
    const query = status ? `SELECT cc.id, cc.folio, cc.starts_at, cc.ends_at, cc.duration_days, cc.process_type, cc.status, e.name AS absent_employee FROM coverage_cases cc JOIN absences a ON a.id = cc.absence_id JOIN employees e ON e.id = a.employee_id JOIN groups g ON g.id = cc.group_id WHERE g.organization_id = ? AND cc.status = ? ORDER BY cc.created_at DESC LIMIT ?` : `SELECT cc.id, cc.folio, cc.starts_at, cc.ends_at, cc.duration_days, cc.process_type, cc.status, e.name AS absent_employee FROM coverage_cases cc JOIN absences a ON a.id = cc.absence_id JOIN employees e ON e.id = a.employee_id JOIN groups g ON g.id = cc.group_id WHERE g.organization_id = ? ORDER BY cc.created_at DESC LIMIT ?`;
    const result = status ? await env.DB.prepare(query).bind(env.MCP_ORGANIZATION_ID, status, limit).all() : await env.DB.prepare(query).bind(env.MCP_ORGANIZATION_ID, limit).all();
    return text(result.results ?? []);
  });
  server.registerTool('get_coverage', { description: 'Consulta expediente, asignaciones y aprobaciones.', inputSchema: z.object({ coverageCaseId: z.string() }) }, async ({ coverageCaseId }) => {
    const item = await env.DB.prepare('SELECT cc.* FROM coverage_cases cc JOIN groups g ON g.id = cc.group_id WHERE cc.id = ? AND g.organization_id = ?').bind(coverageCaseId, env.MCP_ORGANIZATION_ID).first();
    if (!item) return notFound('coverage_case');
    const assignments = await env.DB.prepare('SELECT * FROM temporary_assignments WHERE coverage_case_id = ? ORDER BY chain_order').bind(coverageCaseId).all();
    const approvals = await env.DB.prepare("SELECT * FROM approvals WHERE entity_type = 'COVERAGE_CASE' AND entity_id = ? ORDER BY requested_at").bind(coverageCaseId).all();
    return text({ item, assignments: assignments.results ?? [], approvals: approvals.results ?? [] });
  });
  server.registerTool('get_rotation_queue', { description: 'Consulta el orden vigente de una fila.', inputSchema: z.object({ groupId: z.string(), sourceLevelId: z.string(), targetLevelId: z.string() }) }, async ({ groupId, sourceLevelId, targetLevelId }) => {
    const result = await env.DB.prepare(`SELECT rqe.queue_position, rqe.availability, rqe.last_coverage_at, rqe.times_selected, e.id AS employee_id, e.name FROM rotation_pools rp JOIN rotation_queue_entries rqe ON rqe.pool_id = rp.id JOIN employees e ON e.id = rqe.employee_id JOIN groups g ON g.id = rp.group_id WHERE rp.group_id = ? AND rp.source_level_id = ? AND rp.target_level_id = ? AND g.organization_id = ? ORDER BY rqe.queue_position`).bind(groupId, sourceLevelId, targetLevelId, env.MCP_ORGANIZATION_ID).all();
    return text(result.results ?? []);
  });
  server.registerTool('get_competition', { description: 'Consulta concurso, elegibilidad y resultados.', inputSchema: z.object({ competitionId: z.string() }) }, async ({ competitionId }) => {
    const competition = await env.DB.prepare('SELECT c.* FROM competitions c JOIN coverage_cases cc ON cc.id = c.coverage_case_id JOIN groups g ON g.id = cc.group_id WHERE c.id = ? AND g.organization_id = ?').bind(competitionId, env.MCP_ORGANIZATION_ID).first();
    if (!competition) return notFound('competition');
    const candidates = await env.DB.prepare('SELECT cc.*, e.name, e.employee_number FROM competition_candidates cc JOIN employees e ON e.id = cc.employee_id WHERE cc.competition_id = ? ORDER BY e.name').bind(competitionId).all();
    return text({ competition, candidates: candidates.results ?? [] });
  });
  server.registerTool('get_audit_trail', { description: 'Consulta el historial inmutable.', inputSchema: z.object({ entityType: z.string(), entityId: z.string(), limit: z.number().int().min(1).max(200).default(100) }) }, async ({ entityType, entityId, limit }) => {
    const result = await env.DB.prepare('SELECT actor_id, actor_type, action, rule_applied, reason, previous_value_json, new_value_json, occurred_at FROM audit_events WHERE organization_id = ? AND entity_type = ? AND entity_id = ? ORDER BY occurred_at ASC LIMIT ?').bind(env.MCP_ORGANIZATION_ID, entityType, entityId, limit).all();
    return text(result.results ?? []);
  });
  return server;
}

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    if (!env.MCP_SERVICE_TOKEN || request.headers.get('authorization') !== `Bearer ${env.MCP_SERVICE_TOKEN}`) return new Response('Unauthorized', { status: 401 });
    const handler = createMcpHandler(() => createServer(env), { route: '/mcp', legacy: 'stateless', responseMode: 'auto', ...(env.MCP_ALLOWED_HOSTNAME ? { allowedHostnames: [env.MCP_ALLOWED_HOSTNAME] } : {}), corsOptions: false, onerror: (error) => console.error('MCP error', error) });
    return handler(request, env, context);
  },
} satisfies ExportedHandler<Env>;
