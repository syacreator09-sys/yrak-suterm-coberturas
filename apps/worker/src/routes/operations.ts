import { Hono } from 'hono';
import { authenticate, requireRoles } from '../auth.js';
import type { AppBindings } from '../types.js';

export const operationRoutes = new Hono<AppBindings>();
operationRoutes.use('*', authenticate);

operationRoutes.get(
  '/configuration-summary',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'AUDITOR', 'OPERATOR'),
  async (context) => {
    const organizationId = context.get('user').organizationId;
    const [groups, levels, transitions, requirements, targetRequirements] = await context.env.DB.batch([
      context.env.DB.prepare('SELECT id, name, description, active FROM groups WHERE organization_id = ? ORDER BY name').bind(organizationId),
      context.env.DB.prepare(`SELECT l.id, l.group_id, l.level_number, l.name, l.rank_order, l.active
        FROM levels l JOIN groups g ON g.id = l.group_id
        WHERE g.organization_id = ? ORDER BY g.name, l.rank_order DESC`).bind(organizationId),
      context.env.DB.prepare(`SELECT lt.id, lt.group_id, lt.source_level_id, lt.target_level_id, lt.active
        FROM level_transitions lt JOIN groups g ON g.id = lt.group_id
        WHERE g.organization_id = ? ORDER BY lt.group_id`).bind(organizationId),
      context.env.DB.prepare(`SELECT id, name, requirement_type, validity_days, active
        FROM requirements WHERE organization_id = ? ORDER BY name`).bind(organizationId),
      context.env.DB.prepare(`SELECT tr.target_level_id, tr.requirement_id, tr.mandatory,
          tr.valid_for_entire_coverage
        FROM target_level_requirements tr JOIN levels l ON l.id = tr.target_level_id
        JOIN groups g ON g.id = l.group_id WHERE g.organization_id = ?`).bind(organizationId),
    ]);
    return context.json({
      groups: groups.results ?? [],
      levels: levels.results ?? [],
      transitions: transitions.results ?? [],
      requirements: requirements.results ?? [],
      targetRequirements: targetRequirements.results ?? [],
    });
  },
);

operationRoutes.get(
  '/approvals',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'COMMITTEE', 'AUDITOR'),
  async (context) => {
    const result = await context.env.DB.prepare(`SELECT a.*, cc.folio, cc.process_type,
        cc.starts_at, cc.ends_at, e.name AS proposed_employee
      FROM approvals a JOIN coverage_cases cc ON cc.id = a.entity_id
      JOIN groups g ON g.id = cc.group_id
      LEFT JOIN temporary_assignments ta ON ta.coverage_case_id = cc.id AND ta.status = 'PROPOSED'
      LEFT JOIN employees e ON e.id = ta.employee_id
      WHERE a.entity_type = 'COVERAGE_CASE' AND g.organization_id = ?
      ORDER BY CASE a.status WHEN 'PENDING' THEN 0 ELSE 1 END, a.requested_at DESC LIMIT 200`)
      .bind(context.get('user').organizationId)
      .all();
    return context.json({ items: result.results ?? [] });
  },
);

operationRoutes.get(
  '/competitions',
  requireRoles('ADMIN', 'HR', 'COMMITTEE', 'AUDITOR'),
  async (context) => {
    const result = await context.env.DB.prepare(`SELECT c.id, c.coverage_case_id, c.status,
        c.registration_starts_at, c.registration_ends_at, c.exam_at, c.minimum_score,
        cc.folio, cc.starts_at, cc.ends_at,
        SUM(CASE WHEN candidate.eligibility_status = 'ELIGIBLE' THEN 1 ELSE 0 END) AS eligible_count,
        SUM(CASE WHEN candidate.eligibility_status = 'INELIGIBLE' THEN 1 ELSE 0 END) AS ineligible_count
      FROM competitions c JOIN coverage_cases cc ON cc.id = c.coverage_case_id
      JOIN groups g ON g.id = cc.group_id
      LEFT JOIN competition_candidates candidate ON candidate.competition_id = c.id
      WHERE g.organization_id = ? GROUP BY c.id ORDER BY c.created_at DESC LIMIT 200`)
      .bind(context.get('user').organizationId)
      .all();
    return context.json({ items: result.results ?? [] });
  },
);

operationRoutes.get(
  '/rotation-pools',
  requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'AUDITOR', 'OPERATOR'),
  async (context) => {
    const result = await context.env.DB.prepare(`SELECT rp.id AS pool_id, g.name AS group_name,
        source.name AS source_level, target.name AS target_level, rqe.queue_position,
        rqe.availability, rqe.times_selected, rqe.last_coverage_at,
        e.id AS employee_id, e.employee_number, e.name AS employee_name
      FROM rotation_pools rp JOIN groups g ON g.id = rp.group_id
      JOIN levels source ON source.id = rp.source_level_id
      JOIN levels target ON target.id = rp.target_level_id
      JOIN rotation_queue_entries rqe ON rqe.pool_id = rp.id
      JOIN employees e ON e.id = rqe.employee_id
      WHERE g.organization_id = ? ORDER BY g.name, target.rank_order DESC, rqe.queue_position`)
      .bind(context.get('user').organizationId)
      .all();
    return context.json({ items: result.results ?? [] });
  },
);

operationRoutes.get(
  '/messages',
  requireRoles('ADMIN', 'HR', 'AUDITOR'),
  async (context) => {
    const result = await context.env.DB.prepare(`SELECT id, coverage_case_id, channel,
        direction, recipient, subject, template_key, status, error_code, created_at, sent_at
      FROM messages WHERE organization_id = ? ORDER BY created_at DESC LIMIT 300`)
      .bind(context.get('user').organizationId)
      .all();
    return context.json({ items: result.results ?? [] });
  },
);
