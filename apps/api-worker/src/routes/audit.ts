import { Hono } from 'hono';
import type { AppBindings } from '../env.js';
import { assertGroupAccess, hasOrganizationWideRead, requireRoles } from '../middleware.js';

export const auditRoutes = new Hono<AppBindings>();

auditRoutes.get('/:entityType/:entityId', requireRoles('ADMIN', 'HR', 'AUDITOR', 'SUPERVISOR', 'COMMITTEE'), async (c) => {
  const user = c.get('user');
  const entityType = c.req.param('entityType').toUpperCase();
  const entityId = c.req.param('entityId');

  if (!hasOrganizationWideRead(user.role)) {
    let scoped: { group_id: string } | null = null;
    if (entityType === 'COVERAGE_CASE') {
      scoped = await c.env.DB.prepare(`SELECT group_id FROM coverage_cases WHERE id=? AND organization_id=?`)
        .bind(entityId, user.organizationId).first<{ group_id: string }>();
    } else if (entityType === 'EMPLOYEE') {
      scoped = await c.env.DB.prepare(`SELECT group_id FROM employees WHERE id=? AND organization_id=?`)
        .bind(entityId, user.organizationId).first<{ group_id: string }>();
    } else if (entityType === 'COMPETITION') {
      scoped = await c.env.DB.prepare(`SELECT cv.group_id FROM competitions cp JOIN coverage_cases cv ON cv.id=cp.coverage_case_id
        WHERE cp.id=? AND cv.organization_id=?`)
        .bind(entityId, user.organizationId).first<{ group_id: string }>();
    } else if (entityType === 'COMPETITION_CANDIDATE') {
      scoped = await c.env.DB.prepare(`SELECT cv.group_id FROM competition_candidates cc
        JOIN competitions cp ON cp.id=cc.competition_id JOIN coverage_cases cv ON cv.id=cp.coverage_case_id
        WHERE cc.id=? AND cv.organization_id=?`)
        .bind(entityId, user.organizationId).first<{ group_id: string }>();
    } else if (entityType === 'SCORE_REVISION') {
      scoped = await c.env.DB.prepare(`SELECT cv.group_id FROM competition_score_revisions r
        JOIN competition_candidates cc ON cc.id=r.candidate_id JOIN competitions cp ON cp.id=cc.competition_id
        JOIN coverage_cases cv ON cv.id=cp.coverage_case_id WHERE r.id=? AND cv.organization_id=?`)
        .bind(entityId, user.organizationId).first<{ group_id: string }>();
    } else if (entityType === 'APPEAL') {
      scoped = await c.env.DB.prepare(`SELECT cv.group_id FROM appeals a JOIN coverage_cases cv ON cv.id=a.coverage_case_id
        WHERE a.id=? AND a.organization_id=?`)
        .bind(entityId, user.organizationId).first<{ group_id: string }>();
    } else if (entityType === 'TEMPORARY_ASSIGNMENT') {
      scoped = await c.env.DB.prepare(`SELECT cv.group_id FROM temporary_assignments a JOIN coverage_cases cv ON cv.id=a.coverage_case_id
        WHERE a.id=? AND cv.organization_id=?`)
        .bind(entityId, user.organizationId).first<{ group_id: string }>();
    }
    if (!scoped) return c.json({ error: 'AUDIT_ENTITY_FORBIDDEN' }, 403);
    await assertGroupAccess(c, scoped.group_id);
  }

  const rows = await c.env.DB.prepare(`SELECT id,actor_id,actor_role,action,previous_value_json,new_value_json,rule_applied,reason,correlation_id,created_at
    FROM audit_events WHERE organization_id=? AND entity_type=? AND entity_id=? ORDER BY created_at,id`)
    .bind(user.organizationId, entityType, entityId).all();
  return c.json({ items: rows.results ?? [] });
});
