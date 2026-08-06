import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { appendAudit } from '../audit.js';
import { authenticate, requireRoles } from '../auth.js';
import { requireIdempotency } from '../idempotency.js';
import type { AppBindings } from '../types.js';

const RoleSchema = z.enum([
  'ADMIN',
  'HR',
  'SUPERVISOR',
  'COMMITTEE',
  'OPERATOR',
  'EMPLOYEE',
  'AUDITOR',
]);

export const userRoutes = new Hono<AppBindings>();
userRoutes.use('*', authenticate);
userRoutes.use('*', requireRoles('ADMIN'));

userRoutes.get('/users', async (context) => {
  const result = await context.env.DB.prepare(
    `SELECT u.id, u.employee_id, u.external_subject,
      u.email, u.display_name, u.active,
      GROUP_CONCAT(ur.role) AS roles
    FROM app_users u LEFT JOIN user_roles ur ON ur.user_id = u.id
    WHERE u.organization_id = ? GROUP BY u.id ORDER BY u.display_name`,
  )
    .bind(context.get('user').organizationId)
    .all();
  return context.json({ items: result.results ?? [] });
});

userRoutes.post(
  '/users',
  requireIdempotency('CREATE_USER'),
  zValidator(
    'json',
    z.object({
      employeeId: z.string().nullable().optional(),
      externalSubject: z.string().min(1),
      email: z.email(),
      displayName: z.string().min(2),
      roles: z.array(RoleSchema).min(1),
      groupIds: z.array(z.string()).default([]),
    }),
  ),
  async (context) => {
    const input = context.req.valid('json');
    const actor = context.get('user');
    const id = crypto.randomUUID();
    const statements: D1PreparedStatement[] = [
      context.env.DB.prepare(
        `INSERT INTO app_users (
        id, organization_id, employee_id, external_subject, email, display_name, active
      ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      ).bind(
        id,
        actor.organizationId,
        input.employeeId ?? null,
        input.externalSubject,
        input.email,
        input.displayName,
      ),
    ];
    for (const role of input.roles) {
      if (['SUPERVISOR', 'OPERATOR'].includes(role) && input.groupIds.length > 0) {
        for (const groupId of input.groupIds) {
          statements.push(
            context.env.DB.prepare(
              'INSERT INTO user_roles (user_id, role, group_id) VALUES (?, ?, ?)',
            ).bind(id, role, groupId),
          );
        }
      } else {
        statements.push(
          context.env.DB.prepare(
            'INSERT INTO user_roles (user_id, role, group_id) VALUES (?, ?, NULL)',
          ).bind(id, role),
        );
      }
    }
    await context.env.DB.batch(statements);
    await appendAudit(context.env, {
      organizationId: actor.organizationId,
      actor,
      entityType: 'APP_USER',
      entityId: id,
      action: 'CREATED',
      newValue: { email: input.email, roles: input.roles, groupIds: input.groupIds },
      correlationId: context.get('correlationId'),
    });
    return context.json({ id, ...input }, 201);
  },
);
