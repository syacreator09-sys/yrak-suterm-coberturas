import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { authenticate, requireRoles } from '../auth.js';
import { appendAudit } from '../audit.js';
import type { AppBindings } from '../types.js';

export const configurationRoutes = new Hono<AppBindings>();
configurationRoutes.use('*', authenticate);
configurationRoutes.use('*', requireRoles('ADMIN', 'HR'));

configurationRoutes.post(
  '/groups',
  zValidator('json', z.object({ name: z.string().min(1), description: z.string().optional() })),
  async (context) => {
    const input = context.req.valid('json');
    const user = context.get('user');
    const id = crypto.randomUUID();
    await context.env.DB.prepare(
      'INSERT INTO groups (id, organization_id, name, description, active) VALUES (?, ?, ?, ?, 1)',
    ).bind(id, user.organizationId, input.name, input.description ?? null).run();
    await appendAudit(context.env, {
      organizationId: user.organizationId,
      actor: user,
      entityType: 'GROUP',
      entityId: id,
      action: 'CREATED',
      newValue: input,
      correlationId: context.get('correlationId'),
    });
    return context.json({ id, ...input }, 201);
  },
);

configurationRoutes.post(
  '/groups/:groupId/levels',
  zValidator('json', z.object({ number: z.number().int(), name: z.string(), rankOrder: z.number().int() })),
  async (context) => {
    const input = context.req.valid('json');
    const id = crypto.randomUUID();
    await context.env.DB.prepare(
      'INSERT INTO levels (id, group_id, level_number, name, rank_order, active) VALUES (?, ?, ?, ?, ?, 1)',
    ).bind(id, context.req.param('groupId'), input.number, input.name, input.rankOrder).run();
    return context.json({ id, groupId: context.req.param('groupId'), ...input }, 201);
  },
);

configurationRoutes.post(
  '/level-transitions',
  zValidator('json', z.object({ groupId: z.string(), sourceLevelId: z.string(), targetLevelId: z.string() })),
  async (context) => {
    const input = context.req.valid('json');
    const id = crypto.randomUUID();
    await context.env.DB.prepare(`INSERT INTO level_transitions (
      id, group_id, source_level_id, target_level_id, active
    ) VALUES (?, ?, ?, ?, 1)`)
      .bind(id, input.groupId, input.sourceLevelId, input.targetLevelId)
      .run();
    return context.json({ id, ...input }, 201);
  },
);

configurationRoutes.post(
  '/requirements',
  zValidator(
    'json',
    z.object({
      name: z.string(),
      requirementType: z.enum(['COURSE','CERTIFICATION','PREREQUISITE_EXAM','DOCUMENT','EXPERIENCE','OTHER']),
      validityDays: z.number().int().positive().nullable().optional(),
    }),
  ),
  async (context) => {
    const input = context.req.valid('json');
    const id = crypto.randomUUID();
    await context.env.DB.prepare(`INSERT INTO requirements (
      id, organization_id, name, requirement_type, validity_days, active
    ) VALUES (?, ?, ?, ?, ?, 1)`)
      .bind(id, context.get('user').organizationId, input.name, input.requirementType, input.validityDays ?? null)
      .run();
    return context.json({ id, ...input }, 201);
  },
);

configurationRoutes.post(
  '/levels/:levelId/requirements',
  zValidator('json', z.object({ requirementId: z.string(), mandatory: z.boolean().default(true), validForEntireCoverage: z.boolean().default(true) })),
  async (context) => {
    const input = context.req.valid('json');
    await context.env.DB.prepare(`INSERT INTO target_level_requirements (
      target_level_id, requirement_id, mandatory, valid_for_entire_coverage
    ) VALUES (?, ?, ?, ?)`)
      .bind(context.req.param('levelId'), input.requirementId, input.mandatory ? 1 : 0, input.validForEntireCoverage ? 1 : 0)
      .run();
    return context.json({ targetLevelId: context.req.param('levelId'), ...input }, 201);
  },
);
