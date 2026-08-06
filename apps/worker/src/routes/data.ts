import { zValidator } from '@hono/zod-validator';
import { parseCsv, toCsv } from '@yrak/csv';
import { Hono } from 'hono';
import { z } from 'zod';
import { appendAudit } from '../audit.js';
import { authenticate, requireRoles } from '../auth.js';
import { requireIdempotency } from '../idempotency.js';
import type { AppBindings } from '../types.js';

const EmployeeImportRowSchema = z.object({
  employeeNumber: z.string().min(1),
  name: z.string().min(2),
  email: z.union([z.email(), z.literal('')]).transform((value) => value || null),
  groupId: z.string().min(1),
  baseLevelId: z.string().min(1),
  seniorityDate: z.string().min(1),
});

export const dataRoutes = new Hono<AppBindings>();
dataRoutes.use('*', authenticate);

dataRoutes.get(
  '/exports/employees.csv',
  requireRoles('ADMIN', 'HR', 'AUDITOR'),
  async (context) => {
    const result = await context.env.DB.prepare(
      `SELECT employee_number AS employeeNumber,
      name, COALESCE(email, '') AS email, group_id AS groupId, base_level_id AS baseLevelId,
      seniority_date AS seniorityDate, active
    FROM employees WHERE organization_id = ? ORDER BY name`,
    )
      .bind(context.get('user').organizationId)
      .all<Record<string, unknown>>();
    return context.body(
      toCsv(
        ['employeeNumber', 'name', 'email', 'groupId', 'baseLevelId', 'seniorityDate', 'active'],
        result.results ?? [],
      ),
      200,
      {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="yrak-personal.csv"',
      },
    );
  },
);

dataRoutes.get(
  '/exports/coverages.csv',
  requireRoles('ADMIN', 'HR', 'AUDITOR'),
  async (context) => {
    const result = await context.env.DB.prepare(
      `SELECT cc.folio, e.employee_number AS absentEmployeeNumber,
      e.name AS absentEmployee, cc.starts_at AS startsAt, cc.ends_at AS endsAt,
      cc.duration_days AS durationDays, cc.process_type AS processType, cc.status,
      a.reason, cc.rule_version AS ruleVersion
    FROM coverage_cases cc JOIN absences a ON a.id = cc.absence_id
    JOIN employees e ON e.id = a.employee_id JOIN groups g ON g.id = cc.group_id
    WHERE g.organization_id = ? ORDER BY cc.created_at DESC`,
    )
      .bind(context.get('user').organizationId)
      .all<Record<string, unknown>>();
    return context.body(
      toCsv(
        [
          'folio',
          'absentEmployeeNumber',
          'absentEmployee',
          'startsAt',
          'endsAt',
          'durationDays',
          'processType',
          'status',
          'reason',
          'ruleVersion',
        ],
        result.results ?? [],
      ),
      200,
      {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="yrak-coberturas.csv"',
      },
    );
  },
);

dataRoutes.post('/imports/employees/preview', requireRoles('ADMIN', 'HR'), async (context) => {
  const body = await context.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return context.json({ error: 'CSV_FILE_REQUIRED' }, 400);
  if (file.size > 5 * 1024 * 1024) return context.json({ error: 'CSV_FILE_TOO_LARGE' }, 413);
  const parsed = parseCsv(await file.text());
  const organizationId = context.get('user').organizationId;
  const existing = await context.env.DB.prepare(
    'SELECT employee_number FROM employees WHERE organization_id = ?',
  )
    .bind(organizationId)
    .all<{ employee_number: string }>();
  const existingNumbers = new Set((existing.results ?? []).map((row) => row.employee_number));
  const fileNumbers = new Set<string>();
  const rows = parsed.map((row, index) => {
    const result = EmployeeImportRowSchema.safeParse(row);
    const errors: string[] = result.success
      ? []
      : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    const employeeNumber = row.employeeNumber ?? '';
    if (existingNumbers.has(employeeNumber)) errors.push('employeeNumber: ya existe');
    if (fileNumbers.has(employeeNumber))
      errors.push('employeeNumber: duplicado dentro del archivo');
    fileNumbers.add(employeeNumber);
    return { rowNumber: index + 2, data: result.success ? result.data : row, errors };
  });
  return context.json({
    total: rows.length,
    valid: rows.filter((row) => row.errors.length === 0).length,
    invalid: rows.filter((row) => row.errors.length > 0).length,
    rows,
  });
});

dataRoutes.post(
  '/imports/employees/commit',
  requireRoles('ADMIN', 'HR'),
  requireIdempotency('IMPORT_EMPLOYEES'),
  zValidator('json', z.object({ rows: z.array(EmployeeImportRowSchema).min(1).max(5000) })),
  async (context) => {
    const user = context.get('user');
    const rows = context.req.valid('json').rows;
    const statements = rows.map((row) =>
      context.env.DB.prepare(
        `INSERT INTO employees (
        id, organization_id, group_id, base_level_id, employee_number, name, email,
        seniority_date, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      ).bind(
        crypto.randomUUID(),
        user.organizationId,
        row.groupId,
        row.baseLevelId,
        row.employeeNumber,
        row.name,
        row.email,
        new Date(row.seniorityDate).toISOString(),
      ),
    );
    await context.env.DB.batch(statements);
    await appendAudit(context.env, {
      organizationId: user.organizationId,
      actor: user,
      entityType: 'EMPLOYEE_IMPORT',
      entityId: crypto.randomUUID(),
      action: 'IMPORTED',
      newValue: { count: rows.length },
      correlationId: context.get('correlationId'),
    });
    return context.json({ imported: rows.length }, 201);
  },
);
