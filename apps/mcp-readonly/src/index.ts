import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpHandler } from 'agents/mcp';
import { z } from 'zod';

interface Env {
  DB: D1Database;
  MCP_SERVICE_TOKEN: string;
  MCP_ORGANIZATION_ID: string;
  MCP_ALLOWED_HOSTNAME?: string;
}

function result(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

function createServer(env: Env): McpServer {
  const server = new McpServer(
    { name: 'yrak-suterm-coberturas-readonly', version: '1.0.0' },
    {
      instructions:
        'Consulta de solo lectura. No elijas candidatos, no cambies calificaciones y no infieras aprobaciones.',
    },
  );

  server.registerTool(
    'list_coverages',
    {
      description: 'Lista expedientes de cobertura de la organización autorizada.',
      inputSchema: z.object({
        status: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(25),
      }),
    },
    async ({ status, limit }) => {
      const rows = status
        ? await env.DB.prepare(
            `SELECT cc.id, cc.folio, cc.starts_at, cc.ends_at,
              cc.duration_days, cc.process_type, cc.status,
              e.name AS absent_employee
            FROM coverage_cases cc
            JOIN absences a ON a.id = cc.absence_id
            JOIN employees e ON e.id = a.employee_id
            JOIN groups g ON g.id = cc.group_id
            WHERE g.organization_id = ? AND cc.status = ?
            ORDER BY cc.created_at DESC LIMIT ?`,
          )
            .bind(env.MCP_ORGANIZATION_ID, status, limit)
            .all()
        : await env.DB.prepare(
            `SELECT cc.id, cc.folio, cc.starts_at, cc.ends_at,
              cc.duration_days, cc.process_type, cc.status,
              e.name AS absent_employee
            FROM coverage_cases cc
            JOIN absences a ON a.id = cc.absence_id
            JOIN employees e ON e.id = a.employee_id
            JOIN groups g ON g.id = cc.group_id
            WHERE g.organization_id = ?
            ORDER BY cc.created_at DESC LIMIT ?`,
          )
            .bind(env.MCP_ORGANIZATION_ID, limit)
            .all();
      return result(rows.results ?? []);
    },
  );

  server.registerTool(
    'get_coverage',
    {
      description: 'Consulta un expediente, sus asignaciones y aprobaciones.',
      inputSchema: z.object({ coverageCaseId: z.string().min(1) }),
    },
    async ({ coverageCaseId }) => {
      const item = await env.DB.prepare(
        `SELECT cc.* FROM coverage_cases cc
          JOIN groups g ON g.id = cc.group_id
          WHERE cc.id = ? AND g.organization_id = ?`,
      )
        .bind(coverageCaseId, env.MCP_ORGANIZATION_ID)
        .first();
      if (!item) return result({ error: 'NOT_FOUND', entity: 'coverage_case' });
      const [assignments, approvals, countedDays] = await env.DB.batch([
        env.DB.prepare(
          `SELECT * FROM temporary_assignments
          WHERE coverage_case_id = ? ORDER BY chain_order`,
        ).bind(coverageCaseId),
        env.DB.prepare(
          `SELECT * FROM approvals
          WHERE entity_type = 'COVERAGE_CASE' AND entity_id = ?
          ORDER BY requested_at`,
        ).bind(coverageCaseId),
        env.DB.prepare(
          `SELECT counted_date, counting_mode, source
          FROM coverage_counted_days WHERE coverage_case_id = ?
          ORDER BY counted_date`,
        ).bind(coverageCaseId),
      ]);
      return result({
        item,
        assignments: assignments.results ?? [],
        approvals: approvals.results ?? [],
        countedDays: countedDays.results ?? [],
      });
    },
  );

  server.registerTool(
    'get_rotation_queue',
    {
      description: 'Consulta la fila vigente de una transición de niveles.',
      inputSchema: z.object({
        groupId: z.string().min(1),
        sourceLevelId: z.string().min(1),
        targetLevelId: z.string().min(1),
      }),
    },
    async ({ groupId, sourceLevelId, targetLevelId }) => {
      const rows = await env.DB.prepare(
        `SELECT rqe.queue_position,
          rqe.availability, rqe.last_coverage_at, rqe.times_selected,
          e.id AS employee_id, e.employee_number, e.name
        FROM rotation_pools rp
        JOIN rotation_queue_entries rqe ON rqe.pool_id = rp.id
        JOIN employees e ON e.id = rqe.employee_id
        JOIN groups g ON g.id = rp.group_id
        WHERE rp.group_id = ? AND rp.source_level_id = ?
          AND rp.target_level_id = ? AND g.organization_id = ?
        ORDER BY rqe.queue_position`,
      )
        .bind(groupId, sourceLevelId, targetLevelId, env.MCP_ORGANIZATION_ID)
        .all();
      return result(rows.results ?? []);
    },
  );

  server.registerTool(
    'get_competition',
    {
      description: 'Consulta concurso, elegibilidad, notas y resultado registrado.',
      inputSchema: z.object({ competitionId: z.string().min(1) }),
    },
    async ({ competitionId }) => {
      const competition = await env.DB.prepare(
        `SELECT c.* FROM competitions c
          JOIN coverage_cases cc ON cc.id = c.coverage_case_id
          JOIN groups g ON g.id = cc.group_id
          WHERE c.id = ? AND g.organization_id = ?`,
      )
        .bind(competitionId, env.MCP_ORGANIZATION_ID)
        .first();
      if (!competition) return result({ error: 'NOT_FOUND', entity: 'competition' });
      const candidates = await env.DB.prepare(
        `SELECT candidate.*, e.name,
          e.employee_number
        FROM competition_candidates candidate
        JOIN employees e ON e.id = candidate.employee_id
        WHERE candidate.competition_id = ? ORDER BY candidate.ranking, e.name`,
      )
        .bind(competitionId)
        .all();
      return result({ competition, candidates: candidates.results ?? [] });
    },
  );

  server.registerTool(
    'get_employee_eligibility',
    {
      description: 'Consulta requisitos registrados de una persona sin recalcular ni decidir.',
      inputSchema: z.object({ employeeId: z.string().min(1) }),
    },
    async ({ employeeId }) => {
      const employee = await env.DB.prepare(
        `SELECT id, employee_number, name,
          base_level_id, group_id
        FROM employees WHERE id = ? AND organization_id = ?`,
      )
        .bind(employeeId, env.MCP_ORGANIZATION_ID)
        .first();
      if (!employee) return result({ error: 'NOT_FOUND', entity: 'employee' });
      const requirements = await env.DB.prepare(
        `SELECT r.id AS requirement_id,
          r.name, r.requirement_type, er.status, er.completed_at, er.valid_until,
          er.score, er.verified_at
        FROM requirements r
        LEFT JOIN employee_requirements er
          ON er.requirement_id = r.id AND er.employee_id = ?
        WHERE r.organization_id = ? AND r.active = 1
        ORDER BY r.name`,
      )
        .bind(employeeId, env.MCP_ORGANIZATION_ID)
        .all();
      return result({ employee, requirements: requirements.results ?? [] });
    },
  );

  server.registerTool(
    'get_audit_trail',
    {
      description: 'Consulta el historial append-only de una entidad.',
      inputSchema: z.object({
        entityType: z.string().min(1),
        entityId: z.string().min(1),
        limit: z.number().int().min(1).max(200).default(100),
      }),
    },
    async ({ entityType, entityId, limit }) => {
      const rows = await env.DB.prepare(
        `SELECT actor_id, actor_type, action,
          rule_applied, reason, previous_value_json, new_value_json,
          correlation_id, occurred_at
        FROM audit_events
        WHERE organization_id = ? AND entity_type = ? AND entity_id = ?
        ORDER BY occurred_at ASC LIMIT ?`,
      )
        .bind(env.MCP_ORGANIZATION_ID, entityType, entityId, limit)
        .all();
      return result(rows.results ?? []);
    },
  );

  return server;
}

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    const authorization = request.headers.get('authorization');
    if (!env.MCP_SERVICE_TOKEN || authorization !== `Bearer ${env.MCP_SERVICE_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    const handler = createMcpHandler(() => createServer(env), {
      route: '/mcp',
      legacy: 'stateless',
      responseMode: 'auto',
      corsOptions: false,
      ...(env.MCP_ALLOWED_HOSTNAME ? { allowedHostnames: [env.MCP_ALLOWED_HOSTNAME] } : {}),
      onerror: (error) => console.error('MCP error', error),
    });
    return handler(request, env, context);
  },
} satisfies ExportedHandler<Env>;
