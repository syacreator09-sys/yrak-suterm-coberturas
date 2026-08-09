import { Hono } from 'hono';
import type { AppBindings, AuthUser } from '../env.js';
import { verifyOfferToken } from '../services/rotation-offer-service.js';
import { approveCoverageAssignment } from '../services/approval-service.js';
import { rejectRotationCandidate } from '../services/rotation-response-service.js';

export const offerRoutes = new Hono<AppBindings>();

function page(title: string, message: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:sans-serif;max-width:480px;margin:60px auto;text-align:center;color:#172033}
h1{font-size:20px}p{color:#475569}</style></head>
<body><h1>${title}</h1><p>${message}</p></body></html>`;
}

async function loadActor(env: AppBindings['Bindings'], organizationId: string, employeeId: string): Promise<AuthUser> {
  const existing = await env.DB.prepare(`SELECT id, email, role FROM users WHERE organization_id=? AND employee_id=? AND active=1 LIMIT 1`)
    .bind(organizationId, employeeId).first<{ id: string; email: string; role: AuthUser['role'] }>();
  if (existing) return { id: existing.id, organizationId, email: existing.email, role: existing.role, employeeId };
  const employee = await env.DB.prepare(`SELECT email FROM employees WHERE id=?`).bind(employeeId).first<{ email: string | null }>();
  return { id: `employee:${employeeId}`, organizationId, email: employee?.email ?? 'sin-correo@yrak.local', role: 'EMPLOYEE', employeeId };
}

offerRoutes.get('/:assignmentId/accept', async (c) => {
  const token = c.req.query('token');
  if (!token) return c.html(page('Enlace inválido', 'Falta el token de la oferta.'), 400);
  const check = await verifyOfferToken(c.env, c.req.param('assignmentId'), token);
  if (!check.ok) {
    const messages: Record<typeof check.reason, string> = {
      NOT_FOUND: 'No se encontró la oferta.',
      EXPIRED: 'Esta oferta ya venció y fue reasignada al siguiente candidato.',
      ALREADY_RESOLVED: 'Esta oferta ya fue respondida anteriormente.',
      INVALID_TOKEN: 'El enlace no es válido.',
    };
    return c.html(page('No se pudo procesar', messages[check.reason]), 409);
  }
  const row = await c.env.DB.prepare(`SELECT * FROM coverage_cases WHERE id=?`).bind(check.coverageCaseId).first<any>();
  if (!row) return c.html(page('No encontrado', 'El expediente de cobertura ya no existe.'), 404);
  const actor = await loadActor(c.env, row.organization_id, check.employeeId);
  await approveCoverageAssignment(c.env, actor, row, `offer-link:${c.req.param('assignmentId')}`);
  return c.html(page('Cobertura aceptada', 'Gracias, tu cobertura quedó confirmada. Puedes cerrar esta ventana.'));
});

offerRoutes.get('/:assignmentId/reject', async (c) => {
  const token = c.req.query('token');
  if (!token) return c.html(page('Enlace inválido', 'Falta el token de la oferta.'), 400);
  const check = await verifyOfferToken(c.env, c.req.param('assignmentId'), token);
  if (!check.ok) {
    const messages: Record<typeof check.reason, string> = {
      NOT_FOUND: 'No se encontró la oferta.',
      EXPIRED: 'Esta oferta ya venció y fue reasignada al siguiente candidato.',
      ALREADY_RESOLVED: 'Esta oferta ya fue respondida anteriormente.',
      INVALID_TOKEN: 'El enlace no es válido.',
    };
    return c.html(page('No se pudo procesar', messages[check.reason]), 409);
  }
  const row = await c.env.DB.prepare(`SELECT * FROM coverage_cases WHERE id=?`).bind(check.coverageCaseId).first<any>();
  if (!row) return c.html(page('No encontrado', 'El expediente de cobertura ya no existe.'), 404);
  const actor = await loadActor(c.env, row.organization_id, check.employeeId);
  await rejectRotationCandidate(c.env, actor, row, `offer-link:${c.req.param('assignmentId')}`, { reason: 'Rechazado vía enlace de correo' });
  return c.html(page('Cobertura rechazada', 'Registramos tu respuesta. Se ofrecerá al siguiente candidato disponible.'));
});
