import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { appendAudit } from '../audit.js';
import { authenticate, requireRoles } from '../auth.js';
import { requireIdempotency } from '../idempotency.js';
import type { AppBindings } from '../types.js';

export const bulkDataRoutes = new Hono<AppBindings>();
bulkDataRoutes.use('*', authenticate);

bulkDataRoutes.post(
  '/bulk/requirements',
  requireRoles('ADMIN', 'HR'),
  requireIdempotency('BULK_REQUIREMENTS'),
  zValidator(
    'json',
    z.object({
      rows: z
        .array(
          z.object({
            id: z.string().optional(),
            name: z.string().min(2),
            type: z.enum([
              'COURSE',
              'CERTIFICATION',
              'PREREQUISITE_EXAM',
              'DOCUMENT',
              'EXPERIENCE',
              'OTHER',
            ]),
            validityDays: z.number().int().positive().nullable().optional(),
          }),
        )
        .min(1)
        .max(1000),
    }),
  ),
  async (context) => {
    const user = context.get('user');
    const rows = context.req.valid('json').rows;
    await context.env.DB.batch(
      rows.map((row) =>
        context.env.DB.prepare(`INSERT INTO requirements (
          id, organization_id, name, requirement_type, validity_days, active
        ) VALUES (?, ?, ?, ?, ?, 1)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          requirement_type = excluded.requirement_type,
          validity_days = excluded.validity_days,
          active = 1`)
          .bind(
            row.id ?? crypto.randomUUID(),
            user.organizationId,
            row.name,
            row.type,
            row.validityDays ?? null,
          ),
      ),
    );
    await appendAudit(context.env, {
      organizationId: user.organizationId,
      actor: user,
      entityType: 'REQUIREMENT_IMPORT',
      entityId: crypto.randomUUID(),
      action: 'IMPORTED',
      newValue: { count: rows.length },
      correlationId: context.get('correlationId'),
    });
    return context.json({ imported: rows.length }, 201);
  },
);

bulkDataRoutes.post(
  '/bulk/employee-requirements',
  requireRoles('ADMIN', 'HR'),
  requireIdempotency('BULK_EMPLOYEE_REQUIREMENTS'),
  zValidator(
    'json',
    z.object({
      rows: z
        .array(
          z.object({
            employeeNumber: z.string().min(1),
            requirementId: z.string().min(1),
            status: z.enum([
              'COMPLIANT',
              'NON_COMPLIANT',
              'PENDING',
              'EXPIRED',
              'REJECTED',
              'NOT_APPLICABLE',
            ]),
            completedAt: z.iso.datetime().nullable().optional(),
            validUntil: z.iso.datetime().nullable().optional(),
            score: z.number().nullable().optional(),
            evidenceAttachmentId: z.string().nullable().optional(),
          }),
        )
        .min(1)
        .max(5000),
    }),
  ),
  async (context) => {
    const user = context.get('user');
    const rows = context.req.valid('json').rows;
    const statements: D1PreparedStatement[] = [];
    for (const row of rows) {
      const employee = await context.env.DB.prepare(`SELECT id FROM employees
        WHERE organization_id = ? AND employee_number = ?`)
        .bind(user.organizationId, row.employeeNumber)
        .first<{ id: string }>();
      const requirement = await context.env.DB.prepare(`SELECT id FROM requirements
        WHERE organization_id = ? AND id = ?`)
        .bind(user.organizationId, row.requirementId)
        .first<{ id: string }>();
      if (!employee || !requirement) {
        return context.json(
          {
            error: 'BULK_REFERENCE_NOT_FOUND',
            employeeNumber: row.employeeNumber,
            requirementId: row.requirementId,
          },
          422,
        );
      }
      statements.push(
        context.env.DB.prepare(`INSERT INTO employee_requirements (
          id, employee_id, requirement_id, status, completed_at, valid_until,
          score, evidence_attachment_id, verified_by, verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(employee_id, requirement_id) DO UPDATE SET
          status = excluded.status,
          completed_at = excluded.completed_at,
          valid_until = excluded.valid_until,
          score = excluded.score,
          evidence_attachment_id = excluded.evidence_attachment_id,
          verified_by = excluded.verified_by,
          verified_at = datetime('now')`)
          .bind(
            crypto.randomUUID(),
            employee.id,
            requirement.id,
            row.status,
            row.completedAt ?? null,
            row.validUntil ?? null,
            row.score ?? null,
            row.evidenceAttachmentId ?? null,
            user.id,
          ),
      );
    }
    await context.env.DB.batch(statements);
    await appendAudit(context.env, {
      organizationId: user.organizationId,
      actor: user,
      entityType: 'EMPLOYEE_REQUIREMENT_IMPORT',
      entityId: crypto.randomUUID(),
      action: 'IMPORTED',
      newValue: { count: rows.length },
      correlationId: context.get('correlationId'),
    });
    return context.json({ imported: rows.length }, 201);
  },
);

bulkDataRoutes.post(
  '/bulk/shifts',
  requireRoles('ADMIN', 'HR'),
  requireIdempotency('BULK_SHIFTS'),
  zValidator(
    'json',
    z.object({
      rows: z
        .array(
          z.object({
            employeeNumber: z.string().min(1),
            date: z.iso.date(),
            scheduled: z.boolean(),
            shiftCode: z.string().nullable().optional(),
          }),
        )
        .min(1)
        .max(10000),
    }),
  ),
  async (context) => {
    const user = context.get('user');
    const rows = context.req.valid('json').rows;
    const statements: D1PreparedStatement[] = [];
    for (const row of rows) {
      const employee = await context.env.DB.prepare(`SELECT id FROM employees
        WHERE organization_id = ? AND employee_number = ?`)
        .bind(user.organizationId, row.employeeNumber)
        .first<{ id: string }>();
      if (!employee) {
        return context.json(
          { error: 'EMPLOYEE_NOT_FOUND', employeeNumber: row.employeeNumber },
          422,
        );
      }
      statements.push(
        context.env.DB.prepare(`INSERT INTO employee_shift_dates (
          id, employee_id, shift_date, scheduled, shift_code, created_by
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(employee_id, shift_date) DO UPDATE SET
          scheduled = excluded.scheduled,
          shift_code = excluded.shift_code,
          created_by = excluded.created_by`)
          .bind(
            crypto.randomUUID(),
            employee.id,
            row.date,
            row.scheduled ? 1 : 0,
            row.shiftCode ?? null,
            user.id,
          ),
      );
    }
    await context.env.DB.batch(statements);
    return context.json({ imported: rows.length }, 201);
  },
);
