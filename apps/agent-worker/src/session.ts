import { DurableObject } from 'cloudflare:workers';
import { IntakeAgent } from '@yrak/agents';
import { provider } from './provider.js';
import type { Env } from './env.js';

export type AgentKind = 'intake' | 'audit' | 'communication' | 'support';
const MAX_STORED_MESSAGES = 40;

export class YrakAgentSession extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS messages(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`);
  }

  private save(role: 'user' | 'assistant', content: string) {
    this.ctx.storage.sql.exec(
      'INSERT INTO messages(role, content, created_at) VALUES(?,?,?)',
      role,
      content,
      Date.now(),
    );
    this.ctx.storage.sql.exec(
      `DELETE FROM messages WHERE id NOT IN (
        SELECT id FROM messages ORDER BY id DESC LIMIT ?
      )`,
      MAX_STORED_MESSAGES,
    );
  }

  private history() {
    return Array.from(
      this.ctx.storage.sql.exec<{ role: string; content: string; created_at: number }>(
        'SELECT role,content,created_at FROM messages ORDER BY id DESC LIMIT 20',
      ),
    ).reverse();
  }

  async run(kind: AgentKind, organizationId: string, input: Record<string, unknown>) {
    if (organizationId !== this.env.AGENT_ORGANIZATION_ID) {
      throw new Error('AGENT_ORGANIZATION_MISMATCH');
    }

    this.save('user', JSON.stringify(input));
    let result: unknown;

    if (kind === 'intake') {
      const text = String(input.text ?? '');
      if (!text.trim()) throw new Error('TEXT_REQUIRED');
      result = await new IntakeAgent(provider(this.env, 'INTAKE_EXTRACTION')).extractFromText(text);
    } else if (kind === 'audit') {
      const entityType = String(input.entityType ?? '');
      const entityId = String(input.entityId ?? '');
      if (!entityType || !entityId) throw new Error('ENTITY_REQUIRED');
      const rows = await this.env.DB.prepare(`SELECT actor_role,action,
          previous_value_json,new_value_json,rule_applied,reason,created_at
        FROM audit_events
        WHERE organization_id=? AND entity_type=? AND entity_id=?
        ORDER BY created_at,id`)
        .bind(organizationId, entityType, entityId)
        .all();
      const facts = rows.results ?? [];
      const explanation = await provider(this.env, 'AUDIT_EXPLANATION').generate({
        system:
          'Eres el agente de auditoría YRAK. Explica únicamente los hechos entregados. No inventes motivos, reglas ni personas. Si la evidencia no alcanza, dilo. Eres solo lectura.',
        prompt: JSON.stringify({
          question: input.question ?? 'Explica la secuencia de decisiones.',
          facts,
        }),
      });
      result = { facts, explanation };
    } else if (kind === 'communication') {
      const caseId = String(input.coverageCaseId ?? '');
      if (!caseId) throw new Error('COVERAGE_CASE_REQUIRED');
      const facts = await this.env.DB.prepare(`SELECT c.id,c.target_level_id,c.starts_on,
          c.ends_on,c.effective_days,c.process_type,c.status,a.employee_id,
          a.base_level_id,a.target_level_id assignment_target,e.name
        FROM coverage_cases c
        LEFT JOIN temporary_assignments a
          ON a.coverage_case_id=c.id
         AND a.status IN('PROPOSED','APPROVED','SCHEDULED','ACTIVE','COMPLETED')
        LEFT JOIN employees e ON e.id=a.employee_id
        WHERE c.id=? AND c.organization_id=?
        ORDER BY a.chain_order LIMIT 1`)
        .bind(caseId, organizationId)
        .first();
      if (!facts) throw new Error('COVERAGE_NOT_FOUND');
      const draft = await provider(this.env, 'COMMUNICATION_DRAFT').generate({
        system:
          'Redacta un borrador institucional claro y breve sobre una cobertura laboral usando sólo los datos proporcionados. No anuncies un ganador ni una asignación si el estado no lo confirma. No envíes nada; sólo redacta.',
        prompt: JSON.stringify({ purpose: input.purpose ?? 'notification', facts }),
      });
      result = { facts, draft, requiresHumanSendApproval: true };
    } else {
      const policyRows = await this.env.DB.prepare(`SELECT policy_key,version,config_json,effective_from
        FROM group_policies WHERE organization_id=?
        ORDER BY effective_from DESC,version DESC LIMIT 20`)
        .bind(organizationId)
        .all();
      const answer = await provider(this.env, 'SUPPORT_RESPONSE').generate({
        system:
          'Eres soporte de YRAK Coberturas. Reglas duras: 1–5 días = rotación; 6+ = requisitos y concurso; el nivel base nunca cambia; IA nunca selecciona ganadores. Si preguntan por una política no presente, indica que debe confirmarse oficialmente.',
        prompt: JSON.stringify({
          question: input.question ?? '',
          policies: policyRows.results ?? [],
          recentConversation: this.history(),
        }),
      });
      result = { answer };
    }

    this.save('assistant', JSON.stringify(result));
    return result;
  }

  async getHistory() {
    return this.history();
  }

  async clearHistory() {
    this.ctx.storage.sql.exec('DELETE FROM messages');
  }
}
