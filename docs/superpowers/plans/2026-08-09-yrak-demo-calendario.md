# Demo profesional en Cloudflare + Calendario propio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terminar la funcionalidad de calendario (feriados, semana laboral, turnos) que hoy es un motor puro sin sistema alrededor, y construir un demo profesional y repetible en un entorno Cloudflare separado (`-demo`) con datos ficticios, escenarios de fallo y cobertura de los ~20 casos del TEST_MATRIX que quedaron sin ejecutar en producción.

**Architecture:** Pilar A extiende el patrón ya establecido de `group_policies` (versionado por fecha efectiva, igual que `loadCoveragePolicy`) para una nueva `policy_key='CALENDAR_SETTINGS'`, corrige un bug real en `loadCalendarContext` (la guarda `SHIFT_CALENDAR_REQUIRED` nunca dispara), y agrega CRUD + UI donde solo existía import masivo. Pilar B clona la topología de producción a un `env.demo` en los `wrangler.jsonc` existentes (mismo código, distintos recursos), siembra datos 100% ficticios vía la API pública (nunca SQL directo, mismo patrón que `seed-production.sh`), y documenta un guión de demo ensayado contra las URLs reales.

**Tech Stack:** Cloudflare Workers (Hono), D1, R2, Queues, Durable Objects, Workflows, Cloudflare Pages, Vitest, Wrangler 4.x, bash + curl + jq para scripts operativos.

## Global Constraints

- Node ≥22, pnpm 10.15.0, monorepo con Turborepo — `pnpm typecheck && pnpm test && pnpm build` deben quedar en verde después de cada tarea.
- Ningún secreto se escribe al repo. Todo token/credencial nuevo va SOLO a `/private/tmp/claude-501/-Users-macpro-cano-ai-command-center-00-core-oh-my-claudecode/ff9c36b1-655e-44c5-be98-2e9ad084d23a/scratchpad/yrak-credenciales.md` (scratchpad de esta sesión), nunca a `.dev.vars`, `wrangler.jsonc` vars, ni commits.
- El D1 de producción (`yrak-suterm-coberturas`, id `bf353405-5422-4b9d-a11d-c8a8a813a4b6`) es **intocable**: ningún comando de este plan corre `wrangler d1 execute` ni `wrangler deploy` sin `--env demo` (o el env por defecto para cambios de código puro que ya se despliegan a producción vía CI manual — ver Task B1 nota).
- Rama de trabajo: `build/demo-calendario-v1`, creada desde `build/connections-v1` (ya hecho). PR al final apunta a `build/connections-v1` (el PR #7 de esa rama a `main` sigue abierto y sin mergear). Ningún merge sin aprobación explícita del usuario.
- Todo texto libre interpolado en HTML (admin-web) pasa por `escapeHtml` de `apps/admin-web/src/components.ts`.
- Toda mutación de datos vía API existente debe llevar `AuditWriter` si el resto de rutas del mismo archivo ya lo hace (patrón establecido en el repo).
- Commits atómicos por tarea, con trailers Constraint/Rejected/Directive/Confidence/Scope-risk/Not-tested cuando aplique (protocolo del repo).
- Timer de oferta del demo: 2 minutos. Cascada encendida (`cascadeEnabled:true`, `cascadeMaximumDepth:3`). Modo de conteo del demo: `WORKING_DAYS` con feriados MX sembrados.

---

## PILAR A — Calendario propio

### Task A1: Backend de calendario — settings versionados, fix del bug de contexto, migración, tests

**Files:**
- Create: `migrations/0020_calendar_settings.sql`
- Create: `apps/api-worker/src/services/calendar-settings-service.ts`
- Modify: `apps/api-worker/src/services/calendar-service.ts`
- Modify: `packages/calendar/src/calendar-engine.test.ts`
- Modify: `packages/acceptance-tests/src/business-rules.test.ts`

**Interfaces:**
- Produces: `loadCalendarSettings(env: AppEnv, organizationId: string, groupId: string, atDate: string): Promise<{ config: { workingWeekdays: number[] }; id: string | null }>` — usado por Task A2 (ruta GET settings) y por `calendar-service.ts` en esta misma tarea.
- Produces: `DEFAULT_CALENDAR_SETTINGS: { workingWeekdays: number[] }` (valor `[1,2,3,4,5]`) — usado por Task A2.
- Consumes: `CalendarContext` de `@yrak/calendar` (ya existe, sin cambios de firma).

- [ ] **Step 1: Migración 0020 — índice de feriados + drop de tabla muerta**

Crear `migrations/0020_calendar_settings.sql`:

```sql
CREATE INDEX idx_holidays_org_date ON holidays(organization_id, holiday_date);

DROP TABLE employee_shifts;
```

`employee_shifts` se creó en `0006_auth_policies_calendar.sql` y ningún código del repo la referencia (verificado por grep exhaustivo); está vacía en producción. El índice acelera `loadCalendarContext`, que hoy hace table-scan sobre `holidays` en cada preview/creación de cobertura.

- [ ] **Step 2: Aplicar la migración en local y verificar**

```bash
cd apps/api-worker && pnpm exec wrangler d1 migrations apply yrak-suterm-coberturas --local
```

Expected: aplica `0020_calendar_settings.sql` sin error (las 0001-0019 ya están aplicadas localmente de sesiones previas).

- [ ] **Step 3: Escribir `calendar-settings-service.ts`**

Crear `apps/api-worker/src/services/calendar-settings-service.ts`:

```ts
import type { AppEnv } from '../env.js';

export interface CalendarSettingsConfig { workingWeekdays: number[] }
export const DEFAULT_CALENDAR_SETTINGS: CalendarSettingsConfig = { workingWeekdays: [1, 2, 3, 4, 5] };

export async function loadCalendarSettings(env: AppEnv, organizationId: string, groupId: string, atDate: string): Promise<{ config: CalendarSettingsConfig; id: string | null }> {
  const row = await env.DB.prepare(`SELECT id, config_json FROM group_policies
    WHERE organization_id = ? AND (group_id = ? OR group_id IS NULL) AND policy_key = 'CALENDAR_SETTINGS'
      AND effective_from <= ? AND (effective_to IS NULL OR effective_to >= ?)
    ORDER BY CASE WHEN group_id = ? THEN 0 ELSE 1 END, version DESC LIMIT 1`)
    .bind(organizationId, groupId, atDate, atDate, groupId)
    .first<{ id: string; config_json: string }>();
  if (!row) return { config: DEFAULT_CALENDAR_SETTINGS, id: null };
  return { config: { ...DEFAULT_CALENDAR_SETTINGS, ...(JSON.parse(row.config_json) as Partial<CalendarSettingsConfig>) }, id: row.id };
}
```

Mismo patrón exacto que `loadCoveragePolicy` en `apps/api-worker/src/services/policy-service.ts:4` (resolución por fecha efectiva, prioriza grupo sobre organización, versión más alta). Reutiliza la tabla `group_policies` existente — sin tabla nueva.

- [ ] **Step 4: Corregir el bug real en `loadCalendarContext`**

Reemplazar el contenido completo de `apps/api-worker/src/services/calendar-service.ts`:

```ts
import type { CalendarContext } from '@yrak/calendar';
import type { AppEnv } from '../env.js';
import { loadCalendarSettings } from './calendar-settings-service.js';

export async function loadCalendarContext(env: AppEnv, organizationId: string, groupId: string, startDate: string, endDate: string): Promise<CalendarContext> {
  const [holidayRows, shiftRows, settings] = await Promise.all([
    env.DB.prepare(`SELECT holiday_date FROM holidays WHERE organization_id=? AND (group_id=? OR group_id IS NULL) AND holiday_date BETWEEN ? AND ?`).bind(organizationId, groupId, startDate, endDate).all<{ holiday_date: string }>(),
    env.DB.prepare(`SELECT shift_date FROM group_shift_dates WHERE group_id=? AND scheduled=1 AND shift_date BETWEEN ? AND ?`).bind(groupId, startDate, endDate).all<{ shift_date: string }>(),
    loadCalendarSettings(env, organizationId, groupId, startDate),
  ]);
  const shiftDates = shiftRows.results ?? [];
  return {
    workingWeekdays: new Set(settings.config.workingWeekdays),
    holidays: new Set((holidayRows.results ?? []).map((r) => r.holiday_date)),
    ...(shiftDates.length ? { shiftDates: new Set(shiftDates.map((r) => r.shift_date)) } : {}),
  };
}
```

Dos cambios de comportamiento respecto al original:
1. `workingWeekdays` ahora viene de `loadCalendarSettings` en vez de nunca definirse — la semana laboral es configurable por grupo (default L-V si no hay fila).
2. `shiftDates` es `undefined` cuando no hay filas, en vez de un `Set` vacío siempre presente — esto reactiva la guarda `SHIFT_CALENDAR_REQUIRED` en `packages/calendar/src/calendar-engine.ts:32` (`if (!context.shiftDates) throw new DomainError('SHIFT_CALENDAR_REQUIRED', ...)`). Antes de este fix, crear una cobertura con `dayCountingMode='SHIFTS'` sin turnos cargados devolvía `effectiveDays=0` en silencio; ahora devuelve un 400 explícito.

- [ ] **Step 5: Tests del motor — semana laboral personalizada y rango invertido**

Agregar a `packages/calendar/src/calendar-engine.test.ts` (después de la última línea `it('rechaza fechas inexistentes'...)`, antes del `});` de cierre del `describe`):

```ts
  it('respeta una semana laboral personalizada (6 días, incluye sábado)', () => expect(computeCountedDates({ start: '2026-08-03', end: '2026-08-09' }, 'WORKING_DAYS', { workingWeekdays: new Set([1, 2, 3, 4, 5, 6]) })).toEqual(['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08']));
  it('rechaza un rango invertido', () => expect(() => enumerateDates({ start: '2026-08-10', end: '2026-08-01' })).toThrow());
```

Ajustar el import de la línea 2 para incluir `enumerateDates`:

```ts
import { computeCountedDates, countEffectiveDays, enumerateDates } from './calendar-engine.js';
```

- [ ] **Step 6: Test de aceptación — el calendario decide ROTACIÓN vs CONCURSO**

Agregar a `packages/acceptance-tests/src/business-rules.test.ts`. Primero ajustar el import de la línea 2 para incluir `computeCountedDates` desde `@yrak/calendar`:

```ts
import { computeCountedDates } from '@yrak/calendar';
```

Y agregar este `it` dentro del `describe('YRAK confirmed business rules', ...)`, después del test `'classifies 6+ effective days as competition'`:

```ts
  it('el mismo rango de fechas cambia de competencia a rotación según feriados y modo de conteo', () => {
    const range = { start: '2026-08-03', end: '2026-08-10' }; // lunes a lunes, 8 días naturales
    const naturalDays = computeCountedDates(range, 'CALENDAR_DAYS').length;
    expect(determineCoverageProcess(naturalDays, DEFAULT_COVERAGE_POLICY)).toBe('COMPETITION'); // 8 días naturales
    const workingDaysWithHoliday = computeCountedDates(range, 'WORKING_DAYS', { holidays: new Set(['2026-08-05', '2026-08-06', '2026-08-07']) }).length;
    expect(determineCoverageProcess(workingDaysWithHoliday, DEFAULT_COVERAGE_POLICY)).toBe('ROTATION'); // 5 laborales: 3,4,10 (+ 5,6,7 excluidos por feriado, 8,9 fin de semana)
  });
```

- [ ] **Step 7: Correr gates**

```bash
pnpm typecheck && pnpm test && pnpm build
```

Expected: verde. `packages/calendar`, `packages/acceptance-tests` y `apps/api-worker` deben recompilar sin error.

- [ ] **Step 8: Commit**

```bash
git add migrations/0020_calendar_settings.sql apps/api-worker/src/services/calendar-settings-service.ts apps/api-worker/src/services/calendar-service.ts packages/calendar/src/calendar-engine.test.ts packages/acceptance-tests/src/business-rules.test.ts
git commit -m "$(cat <<'EOF'
fix: calendario configurable por grupo y guarda SHIFTS reactivada

loadCalendarContext nunca exponía workingWeekdays (semana laboral
hardcodeada L-V) y siempre devolvía shiftDates como Set, incluso vacío,
lo que neutralizaba la guarda SHIFT_CALENDAR_REQUIRED del motor: crear
una cobertura en modo SHIFTS sin turnos cargados daba 0 días efectivos
en silencio en vez de un error claro. Se agrega loadCalendarSettings
(mismo patrón versionado que loadCoveragePolicy, reutiliza group_policies
con policy_key='CALENDAR_SETTINGS') y se corrige el shiftDates undefined
cuando no hay filas.

Constraint: reutilizar group_policies en vez de tabla nueva (patrón ya establecido para políticas versionadas)
Rejected: tabla calendar_settings dedicada | duplica el mecanismo de versionado que group_policies ya resuelve
Confidence: high
Scope-risk: narrow
Not-tested: loadCalendarContext contra D1 real con miles de holidays (solo probado con datos de demo pequeños)
EOF
)"
```

---

### Task A2: API de calendario — CRUD, endurecer imports, OpenAPI

**Files:**
- Create: `apps/api-worker/src/routes/calendar.ts`
- Modify: `apps/api-worker/src/routes/imports.ts`
- Modify: `apps/api-worker/src/index.ts`
- Modify: `openapi/yrak-api.yaml`

**Interfaces:**
- Consumes: `loadCalendarSettings`, `DEFAULT_CALENDAR_SETTINGS` de `./services/calendar-settings-service.js` (Task A1).
- Consumes: `requireRoles`, `assertGroupAccess` de `../middleware.js` (ya existen).
- Produces: rutas montadas en `/v1/calendar/*`, consumidas por Task A3 (UI) y Task B2/B3 (seed y guión de demo).

- [ ] **Step 1: Escribir `apps/api-worker/src/routes/calendar.ts`**

```ts
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppBindings } from '../env.js';
import { assertGroupAccess, requireRoles } from '../middleware.js';
import { AuditWriter } from '@yrak/audit';
import { DEFAULT_CALENDAR_SETTINGS, loadCalendarSettings } from '../services/calendar-settings-service.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const calendarRoutes = new Hono<AppBindings>();

calendarRoutes.get('/holidays', requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'AUDITOR'), zValidator('query', z.object({ groupId: z.string().optional(), from: z.string().regex(DATE_ONLY).optional(), to: z.string().regex(DATE_ONLY).optional() })), async (c) => {
  const u = c.get('user'), q = c.req.valid('query');
  const rows = await c.env.DB.prepare(`SELECT id, group_id, holiday_date, name FROM holidays
    WHERE organization_id=? AND (?='' OR group_id=? OR group_id IS NULL) AND (?='' OR holiday_date>=?) AND (?='' OR holiday_date<=?)
    ORDER BY holiday_date`)
    .bind(u.organizationId, q.groupId ?? '', q.groupId ?? '', q.from ?? '', q.from ?? '', q.to ?? '', q.to ?? '')
    .all();
  return c.json({ items: rows.results ?? [] });
});

calendarRoutes.post('/holidays', requireRoles('ADMIN', 'HR'), zValidator('json', z.object({ groupId: z.string().nullable().optional(), date: z.string().regex(DATE_ONLY, 'INVALID_DATE_FORMAT'), name: z.string().min(1) })), async (c) => {
  const u = c.get('user'), i = c.req.valid('json');
  if (i.groupId) await assertGroupAccess(c, i.groupId);
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO holidays(id,organization_id,group_id,holiday_date,name) VALUES(?,?,?,?,?)
    ON CONFLICT(organization_id,group_id,holiday_date) DO UPDATE SET name=excluded.name`)
    .bind(id, u.organizationId, i.groupId ?? null, i.date, i.name).run();
  await new AuditWriter(c.env.DB).append({ organizationId: u.organizationId, actorId: u.id, actorRole: u.role, entityType: 'HOLIDAY', entityId: id, action: 'CREATED', newValue: i, correlationId: c.get('correlationId') });
  return c.json({ id, ...i }, 201);
});

calendarRoutes.delete('/holidays/:holidayId', requireRoles('ADMIN', 'HR'), async (c) => {
  const u = c.get('user');
  const row = await c.env.DB.prepare(`SELECT id, group_id, holiday_date, name FROM holidays WHERE id=? AND organization_id=?`).bind(c.req.param('holidayId'), u.organizationId).first<{ id: string; group_id: string | null; holiday_date: string; name: string }>();
  if (!row) return c.json({ error: 'HOLIDAY_NOT_FOUND' }, 404);
  await c.env.DB.prepare(`DELETE FROM holidays WHERE id=?`).bind(row.id).run();
  await new AuditWriter(c.env.DB).append({ organizationId: u.organizationId, actorId: u.id, actorRole: u.role, entityType: 'HOLIDAY', entityId: row.id, action: 'DELETED', previousValue: row, correlationId: c.get('correlationId') });
  return c.json({ deleted: true });
});

calendarRoutes.get('/group-shifts', requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'AUDITOR'), zValidator('query', z.object({ groupId: z.string(), from: z.string().regex(DATE_ONLY), to: z.string().regex(DATE_ONLY) })), async (c) => {
  const q = c.req.valid('query');
  await assertGroupAccess(c, q.groupId);
  const rows = await c.env.DB.prepare(`SELECT id, shift_date, scheduled, shift_code FROM group_shift_dates WHERE group_id=? AND shift_date BETWEEN ? AND ? ORDER BY shift_date`).bind(q.groupId, q.from, q.to).all();
  return c.json({ items: rows.results ?? [] });
});

calendarRoutes.get('/settings/:groupId', requireRoles('ADMIN', 'HR', 'SUPERVISOR', 'AUDITOR'), async (c) => {
  const u = c.get('user'), groupId = c.req.param('groupId');
  await assertGroupAccess(c, groupId);
  const settings = await loadCalendarSettings(c.env, u.organizationId, groupId, new Date().toISOString().slice(0, 10));
  return c.json({ id: settings.id, config: settings.config });
});

calendarRoutes.put('/settings/:groupId', requireRoles('ADMIN', 'HR'), zValidator('json', z.object({ workingWeekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7), effectiveFrom: z.string().regex(DATE_ONLY) })), async (c) => {
  const u = c.get('user'), i = c.req.valid('json'), groupId = c.req.param('groupId');
  await assertGroupAccess(c, groupId);
  const latest = await c.env.DB.prepare(`SELECT COALESCE(MAX(version),0) version FROM group_policies WHERE organization_id=? AND group_id=? AND policy_key='CALENDAR_SETTINGS'`).bind(u.organizationId, groupId).first<{ version: number }>();
  const config = { workingWeekdays: [...new Set(i.workingWeekdays)].sort() };
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`INSERT INTO group_policies(id,organization_id,group_id,policy_key,version,config_json,effective_from,created_by) VALUES(?,?,?,'CALENDAR_SETTINGS',?,?,?,?)`)
    .bind(id, u.organizationId, groupId, (latest?.version ?? 0) + 1, JSON.stringify(config), i.effectiveFrom, u.id).run();
  await new AuditWriter(c.env.DB).append({ organizationId: u.organizationId, actorId: u.id, actorRole: u.role, entityType: 'GROUP_POLICY', entityId: id, action: 'CREATED', newValue: { policyKey: 'CALENDAR_SETTINGS', ...config }, ruleApplied: 'CALENDAR_SETTINGS', correlationId: c.get('correlationId') });
  return c.json({ id, version: (latest?.version ?? 0) + 1, config }, 201);
});
```

`DEFAULT_CALENDAR_SETTINGS` se importa pero no se usa directamente en este archivo — se elimina del import si no se referencia (usar solo `loadCalendarSettings`). Ajustar el import de Step 1 a:

```ts
import { loadCalendarSettings } from '../services/calendar-settings-service.js';
```

- [ ] **Step 2: Montar `/v1/calendar` en `index.ts`**

En `apps/api-worker/src/index.ts` línea 1, agregar el import junto a los demás routes:

```ts
import { calendarRoutes } from './routes/calendar.js';
```

En la línea 3, agregar el `app.route` junto a los demás (después de `app.route('/v1/import',importRoutes);`):

```ts
app.route('/v1/calendar',calendarRoutes);
```

- [ ] **Step 3: Endurecer `POST /v1/import/holidays` — validación de fecha, scope de grupo, auditoría**

En `apps/api-worker/src/routes/imports.ts`, reemplazar la línea completa de `importRoutes.post('/holidays', ...)` (línea 8) por:

```ts
importRoutes.post('/holidays',requireRoles('ADMIN','HR'),zValidator('json',z.object({items:z.array(z.object({groupId:z.string().nullable().optional(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'INVALID_DATE_FORMAT'),name:z.string()})).min(1).max(1000)})),async c=>{const u=c.get('user'),items=c.req.valid('json').items;for(const i of items){if(!i.groupId)continue;const g=await c.env.DB.prepare(`SELECT id FROM groups WHERE id=? AND organization_id=?`).bind(i.groupId,u.organizationId).first();if(!g)return c.json({error:'GROUP_SCOPE_MISMATCH',groupId:i.groupId},400);}const ids=items.map(()=>crypto.randomUUID());await c.env.DB.batch(items.map((i,idx)=>c.env.DB.prepare(`INSERT INTO holidays(id,organization_id,group_id,holiday_date,name) VALUES(?,?,?,?,?) ON CONFLICT(organization_id,group_id,holiday_date) DO UPDATE SET name=excluded.name`).bind(ids[idx],u.organizationId,i.groupId??null,i.date,i.name)));await new AuditWriter(c.env.DB).append({organizationId:u.organizationId,actorId:u.id,actorRole:u.role,entityType:'HOLIDAY',entityId:'BULK',action:'IMPORTED',newValue:{count:items.length},correlationId:c.get('correlationId')});return c.json({imported:items.length});});
```

Esto agrega: (a) validación de formato `YYYY-MM-DD` vía regex en el schema Zod (antes aceptaba cualquier string), (b) validación de scope de grupo igual que `/group-shifts` ya tiene, (c) una fila de auditoría `HOLIDAY/IMPORTED` (antes ningún import de calendario auditaba).

Agregar el import de `AuditWriter` al inicio del archivo (línea 1 de `imports.ts` no lo tiene aún):

```ts
import { Hono } from 'hono';import { z } from 'zod';import { zValidator } from '@hono/zod-validator';import type { AppBindings } from '../env.js';import { requireRoles } from '../middleware.js';import { AuditWriter } from '@yrak/audit';
```

- [ ] **Step 4: Agregar auditoría a `POST /v1/import/group-shifts`**

En `imports.ts` línea 9 (la ruta `/group-shifts`), agregar la línea de `AuditWriter` antes del `return`. Reemplazar:

```ts
await c.env.DB.batch(items.map(i=>c.env.DB.prepare(`INSERT INTO group_shift_dates(id,group_id,shift_date,scheduled,shift_code) VALUES(?,?,?,?,?) ON CONFLICT(group_id,shift_date) DO UPDATE SET scheduled=excluded.scheduled,shift_code=excluded.shift_code`).bind(crypto.randomUUID(),i.groupId,i.date,i.scheduled?1:0,i.shiftCode??null)));return c.json({imported:items.length});});
```

por:

```ts
await c.env.DB.batch(items.map(i=>c.env.DB.prepare(`INSERT INTO group_shift_dates(id,group_id,shift_date,scheduled,shift_code) VALUES(?,?,?,?,?) ON CONFLICT(group_id,shift_date) DO UPDATE SET scheduled=excluded.scheduled,shift_code=excluded.shift_code`).bind(crypto.randomUUID(),i.groupId,i.date,i.scheduled?1:0,i.shiftCode??null)));await new AuditWriter(c.env.DB).append({organizationId:u.organizationId,actorId:u.id,actorRole:u.role,entityType:'GROUP_SHIFT_DATE',entityId:'BULK',action:'IMPORTED',newValue:{count:items.length},correlationId:c.get('correlationId')});return c.json({imported:items.length});});
```

- [ ] **Step 5: OpenAPI — schemas de request + rutas nuevas**

En `openapi/yrak-api.yaml`, reemplazar el bloque de `/v1/import/holidays` y `/v1/import/group-shifts` (líneas 518-525 del archivo actual) por:

```yaml
  /v1/import/holidays:
    post:
      operationId: importHolidays
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [items]
              properties:
                items:
                  type: array
                  minItems: 1
                  maxItems: 1000
                  items:
                    type: object
                    required: [date, name]
                    properties:
                      groupId: { type: string, nullable: true }
                      date: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
                      name: { type: string }
      responses: { '200': { description: Holidays imported } }
  /v1/import/group-shifts:
    post:
      operationId: importGroupShifts
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [items]
              properties:
                items:
                  type: array
                  minItems: 1
                  maxItems: 5000
                  items:
                    type: object
                    required: [groupId, date]
                    properties:
                      groupId: { type: string }
                      date: { type: string, pattern: '^\d{4}-\d{2}-\d{2}$' }
                      shiftCode: { type: string, nullable: true }
                      scheduled: { type: boolean, default: true }
      responses: { '200': { description: Shift dates imported } }
  /v1/calendar/holidays:
    get:
      operationId: listHolidays
      parameters:
        - { name: groupId, in: query, schema: { type: string } }
        - { name: from, in: query, schema: { type: string } }
        - { name: to, in: query, schema: { type: string } }
      responses: { '200': { description: Holidays list } }
    post:
      operationId: createHoliday
      responses: { '201': { description: Holiday created } }
  /v1/calendar/holidays/{holidayId}:
    delete:
      operationId: deleteHoliday
      parameters:
        - { name: holidayId, in: path, required: true, schema: { type: string } }
      responses: { '200': { description: Holiday deleted } }
  /v1/calendar/group-shifts:
    get:
      operationId: listGroupShifts
      parameters:
        - { name: groupId, in: query, required: true, schema: { type: string } }
        - { name: from, in: query, required: true, schema: { type: string } }
        - { name: to, in: query, required: true, schema: { type: string } }
      responses: { '200': { description: Group shift dates list } }
  /v1/calendar/settings/{groupId}:
    get:
      operationId: getCalendarSettings
      parameters:
        - { name: groupId, in: path, required: true, schema: { type: string } }
      responses: { '200': { description: Calendar settings for group } }
    put:
      operationId: updateCalendarSettings
      parameters:
        - { name: groupId, in: path, required: true, schema: { type: string } }
      responses: { '201': { description: Calendar settings versioned } }
```

- [ ] **Step 6: Gates**

```bash
pnpm typecheck && pnpm test && pnpm build
```

- [ ] **Step 7: Levantar local y probar la guarda SHIFTS reactivada**

```bash
cd apps/api-worker && pnpm dev &
sleep 3
curl -s -X POST http://127.0.0.1:8787/v1/coverage-cases/preview \
  -H "x-yrak-user-email: admin@yrak.local" -H "x-yrak-dev-token: <DEV_AUTH_TOKEN local>" -H "content-type: application/json" \
  -d '{"groupId":"<groupId con política SHIFTS y 0 turnos>","startDate":"2026-09-01","endDate":"2026-09-05"}'
```

Expected: `400 {"error":"SHIFT_CALENDAR_REQUIRED"}` en vez de `effectiveDays:0`. (El grupo de prueba con política `SHIFTS` se crea en Task B2; si aún no existe, verificar el fix leyendo el código y con el test de Step 6 de A1 — no bloquea el commit de esta tarea.)

- [ ] **Step 8: Commit**

```bash
git add apps/api-worker/src/routes/calendar.ts apps/api-worker/src/routes/imports.ts apps/api-worker/src/index.ts openapi/yrak-api.yaml
git commit -m "$(cat <<'EOF'
feat: CRUD de calendario (feriados, turnos, semana laboral) + endurecer imports

Antes solo existían 2 endpoints de import masivo sin validación de fecha,
sin scope de grupo consistente, y sin auditoría. Se agrega /v1/calendar
con CRUD real de feriados, lectura de turnos y GET/PUT de la semana
laboral por grupo (Task A1), y se endurece POST /v1/import/holidays al
mismo nivel que /group-shifts ya tenía (scope + auditoría), agregando
validación de formato de fecha a ambos.

Confidence: high
Scope-risk: narrow
Directive: /v1/import/holidays y /v1/import/group-shifts siguen existiendo para carga masiva; /v1/calendar/* es para operación día a día desde la UI, no reemplaza el import
EOF
)"
```

---

### Task A3: UI de calendario + seed de feriados mexicanos

**Files:**
- Modify: `apps/admin-web/src/main.ts`
- Create: `examples/demo/holidays.json`

**Interfaces:**
- Consumes: `GET/POST/DELETE /v1/calendar/holidays`, `GET/PUT /v1/calendar/settings/:groupId`, `POST /v1/import/group-shifts`, `POST /v1/coverage-cases/preview` (todas de Task A2, ya existentes para preview).
- Consumes: `table`, `options`, `jsonPanel`, `escapeHtml` de `./components.js` (ya existen, mismas firmas usadas en el resto de `main.ts`).

- [ ] **Step 1: Agregar la vista `calendar` a `apps/admin-web/src/main.ts`**

En la línea 4 (definición del sidebar), agregar `['calendar','Calendario']` después de `['config','Configuración']`:

```ts
app.innerHTML=`<div class="shell"><aside class="sidebar"><h1>YRAK Coberturas</h1><div class="sub">SUTERM / CFE</div>${[['dashboard','Resumen'],['employees','Personal'],['coverages','Coberturas'],['competition','Concursos'],['intake','Documentos / IA'],['config','Configuración'],['calendar','Calendario'],['audit','Auditoría'],['reports','Reportes'],['assistant','Asistente IA']].map(([id,label])=>`<button data-view="${id}">${label}</button>`).join('')}</aside><main class="main" id="view"></main></div>`;const view=document.querySelector<HTMLDivElement>('#view')!;const showError=(e:unknown)=>view.innerHTML=`<div class="panel error">${escapeHtml(String(e))}</div>`;
```

- [ ] **Step 2: Escribir la función `calendar()`**

Insertar la función completa después de la función `async function audit(){...}` (línea 13) y antes de `async function reports(){...}` (línea 14):

```ts
async function calendar(){const groups=await api('/v1/config/groups');view.innerHTML=`<h2>Calendario</h2><div class="grid"><div class="panel"><h3>Feriados</h3><form id="holiday-filter"><label>Grupo (vacío = todos)</label><select name="groupId"><option value="">Toda la organización</option>${options(groups.items)}</select><button class="secondary" type="submit">Filtrar</button></form><div id="holiday-list"></div><h4>Nuevo feriado</h4><form id="holiday-new"><label>Grupo (vacío = feriado de toda la organización)</label><select name="groupId"><option value="">Toda la organización</option>${options(groups.items)}</select><label>Fecha</label><input name="date" type="date" required><label>Nombre</label><input name="name" required><button class="primary">Agregar feriado</button></form></div><div class="panel"><h3>Semana laboral por grupo</h3><form id="settings-form"><label>Grupo</label><select name="groupId" id="settings-group" required><option value="">Seleccione</option>${options(groups.items)}</select><div id="weekday-checks"></div><label>Vigente desde</label><input name="effectiveFrom" type="date" required value="${new Date().toISOString().slice(0,10)}"><button class="primary">Guardar semana laboral</button></form></div><div class="panel"><h3>Turnos masivos (modo SHIFTS)</h3><form id="shifts-form"><label>Grupo</label><select name="groupId" required><option value="">Seleccione</option>${options(groups.items)}</select><label>Fechas (una por línea, YYYY-MM-DD)</label><textarea name="dates" rows="4" placeholder="2026-09-01&#10;2026-09-02"></textarea><button class="primary">Cargar turnos</button></form></div><div class="panel"><h3>Vista previa de clasificación</h3><form id="preview-form"><label>Grupo</label><select name="groupId" required><option value="">Seleccione</option>${options(groups.items)}</select><label>Inicio</label><input name="startDate" type="date" required><label>Fin</label><input name="endDate" type="date" required><button class="primary">Previsualizar</button></form><div id="calendar-preview-output"></div></div></div>`;
const WEEKDAYS=[['1','Lunes'],['2','Martes'],['3','Miércoles'],['4','Jueves'],['5','Viernes'],['6','Sábado'],['0','Domingo']];
async function loadHolidays(groupId?:string){const q=groupId?`?groupId=${encodeURIComponent(groupId)}`:'';const d=await api(`/v1/calendar/holidays${q}`);document.querySelector('#holiday-list')!.innerHTML=`${table(d.items,['holiday_date','name','group_id'])}${d.items.map((x:any)=>`<button class="danger" data-del-holiday="${x.id}">Borrar ${escapeHtml(x.holiday_date)}</button>`).join('')}`;document.querySelectorAll('[data-del-holiday]').forEach(btn=>(btn as HTMLButtonElement).onclick=async()=>{await api(`/v1/calendar/holidays/${(btn as HTMLElement).dataset.delHoliday}`,{method:'DELETE'});await loadHolidays(groupId);});}
await loadHolidays();
document.querySelector<HTMLFormElement>('#holiday-filter')!.onsubmit=async e=>{e.preventDefault();const x:any=Object.fromEntries(new FormData(e.currentTarget as HTMLFormElement));await loadHolidays(x.groupId||undefined);};
document.querySelector<HTMLFormElement>('#holiday-new')!.onsubmit=async e=>{e.preventDefault();const x:any=Object.fromEntries(new FormData(e.currentTarget as HTMLFormElement));if(!x.groupId)x.groupId=null;await api('/v1/calendar/holidays',{method:'POST',body:JSON.stringify(x)});(e.currentTarget as HTMLFormElement).reset();await loadHolidays();};
const settingsGroup=document.querySelector<HTMLSelectElement>('#settings-group')!,weekdayChecks=document.querySelector<HTMLDivElement>('#weekday-checks')!;
async function renderWeekdayChecks(groupId:string){if(!groupId){weekdayChecks.innerHTML='';return;}const d=await api(`/v1/calendar/settings/${groupId}`);const active=new Set(d.config.workingWeekdays);weekdayChecks.innerHTML=WEEKDAYS.map(([v,label])=>`<label style="display:inline-block;margin-right:12px"><input type="checkbox" name="weekday" value="${v}" ${active.has(Number(v))?'checked':''}> ${escapeHtml(label)}</label>`).join('');}
settingsGroup.onchange=()=>renderWeekdayChecks(settingsGroup.value);
document.querySelector<HTMLFormElement>('#settings-form')!.onsubmit=async e=>{e.preventDefault();const form=e.currentTarget as HTMLFormElement;const groupId=(new FormData(form).get('groupId') as string);const effectiveFrom=(new FormData(form).get('effectiveFrom') as string);const workingWeekdays=Array.from(form.querySelectorAll<HTMLInputElement>('input[name="weekday"]:checked')).map(el=>Number(el.value));await api(`/v1/calendar/settings/${groupId}`,{method:'PUT',body:JSON.stringify({workingWeekdays,effectiveFrom})});alert('Semana laboral actualizada');};
document.querySelector<HTMLFormElement>('#shifts-form')!.onsubmit=async e=>{e.preventDefault();const x:any=Object.fromEntries(new FormData(e.currentTarget as HTMLFormElement));const items=String(x.dates).split('\n').map((s:string)=>s.trim()).filter(Boolean).map((date:string)=>({groupId:x.groupId,date,scheduled:true}));if(!items.length){alert('Ingrese al menos una fecha');return;}await api('/v1/import/group-shifts',{method:'POST',body:JSON.stringify({items})});alert(`${items.length} turnos cargados`);};
document.querySelector<HTMLFormElement>('#preview-form')!.onsubmit=async e=>{e.preventDefault();const x:any=Object.fromEntries(new FormData(e.currentTarget as HTMLFormElement));const d=await api('/v1/coverage-cases/preview',{method:'POST',body:JSON.stringify(x)});document.querySelector('#calendar-preview-output')!.innerHTML=`<p><strong>${d.effectiveDays} días efectivos</strong> → <strong>${d.processType==='ROTATION'?'ROTACIÓN':'CONCURSO'}</strong> (modo ${d.dayCountingMode})</p>${jsonPanel(d)}`;};
}
```

- [ ] **Step 3: Registrar la vista en el mapa de vistas**

En la línea final (`const views:any={...}`), agregar `calendar` al objeto:

```ts
const views:any={dashboard,employees,coverages,competition,intake,config,calendar,audit,reports,assistant};document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>views[(b as HTMLElement).dataset.view!]().catch(showError)));dashboard().catch(showError);
```

- [ ] **Step 4: Crear `examples/demo/holidays.json` — feriados oficiales MX 2026-2027**

```json
{
  "items": [
    { "groupId": null, "date": "2026-01-01", "name": "Año Nuevo" },
    { "groupId": null, "date": "2026-02-02", "name": "Día de la Constitución (observado)" },
    { "groupId": null, "date": "2026-03-16", "name": "Natalicio de Benito Juárez (observado)" },
    { "groupId": null, "date": "2026-05-01", "name": "Día del Trabajo" },
    { "groupId": null, "date": "2026-09-16", "name": "Día de la Independencia" },
    { "groupId": null, "date": "2026-11-16", "name": "Revolución Mexicana (observado)" },
    { "groupId": null, "date": "2026-12-25", "name": "Navidad" },
    { "groupId": null, "date": "2027-01-01", "name": "Año Nuevo" },
    { "groupId": null, "date": "2027-02-01", "name": "Día de la Constitución (observado)" },
    { "groupId": null, "date": "2027-03-15", "name": "Natalicio de Benito Juárez (observado)" },
    { "groupId": null, "date": "2027-05-01", "name": "Día del Trabajo" },
    { "groupId": null, "date": "2027-09-16", "name": "Día de la Independencia" },
    { "groupId": null, "date": "2027-11-15", "name": "Revolución Mexicana (observado)" },
    { "groupId": null, "date": "2027-12-25", "name": "Navidad" }
  ]
}
```

Fechas oficiales conforme al Art. 74 de la Ley Federal del Trabajo (México), `groupId: null` = feriado de toda la organización (aplica a todos los grupos, según el `OR group_id IS NULL` de `loadCalendarContext`).

- [ ] **Step 5: Gates**

```bash
pnpm typecheck && pnpm test && pnpm build
```

- [ ] **Step 6: Verificación visual local**

```bash
cd apps/api-worker && pnpm dev &
cd apps/admin-web && pnpm dev &
```

Abrir `http://localhost:5173`, entrar con sesión dev, click en "Calendario" en el sidebar. Verificar: panel de feriados carga (vacío si no se ha sembrado nada aún — Task B2 lo siembra), formulario de nuevo feriado funciona, checkboxes de semana laboral se marcan/desmarcan y persisten tras recargar, vista previa devuelve clasificación.

- [ ] **Step 7: Commit**

```bash
git add apps/admin-web/src/main.ts examples/demo/holidays.json
git commit -m "$(cat <<'EOF'
feat: panel Calendario en el dashboard (feriados, semana laboral, turnos, preview)

Antes /v1/calendar y /v1/import/holidays|group-shifts solo eran
accesibles por curl. Se agrega el panel "Calendario" al admin-web con
alta/baja de feriados, semana laboral configurable por grupo (checkboxes
L-D), carga masiva de turnos, y una vista previa en vivo que muestra
cómo el calendario decide ROTACIÓN vs CONCURSO para un rango de fechas.
Se agrega el seed de feriados oficiales MX 2026-2027 (LFT art. 74) para
Task B2.

Confidence: high
Scope-risk: narrow
EOF
)"
```

---

## PILAR B — Demo profesional en Cloudflare

### Task B1: Entorno demo separado en Cloudflare

**Files:**
- Modify: `apps/api-worker/wrangler.jsonc`
- Modify: `apps/agent-worker/wrangler.jsonc`
- Create: `scripts/demo/deploy-demo.sh`

**Interfaces:**
- Produces: URLs reales `-demo` y credenciales en el scratchpad, consumidas por Task B2 (seed), B3 (guión) y B4 (ejecución de matriz).

- [ ] **Step 1: Agregar `env.demo` a `apps/api-worker/wrangler.jsonc`**

Wrangler soporta múltiples entornos con nombres de recursos y vars propios bajo la clave `env`. Reemplazar el contenido completo del archivo por (agrega el bloque `"env":{"demo":{...}}` al final, antes del `}` de cierre):

```jsonc
{
  "$schema":"node_modules/wrangler/config-schema.json","name":"yrak-suterm-coberturas-api","main":"src/index.ts","compatibility_date":"2026-08-07","observability":{"enabled":true},
  "vars":{"APP_ENV":"development","DEFAULT_TIMEZONE":"America/Mexico_City","PUBLIC_BASE_URL":"https://yrak-suterm-coberturas-api.yrak-suterm.workers.dev","EMAIL_FROM":"REPLACE_WITH_VERIFIED_SENDER","INBOUND_EMAIL_ORGANIZATION_ID":"suterm-cfe","AI_PROVIDER":"compatible","AI_COMPAT_PROVIDER_ID":"nvidia-nim","AI_COMPAT_BASE_URL":"https://integrate.api.nvidia.com/v1","AI_COMPAT_TEXT_MODEL":"deepseek-ai/deepseek-v4-flash-0731","AI_REQUEST_TIMEOUT_MS":"30000","WORKERS_AI_TEXT_MODEL":"@cf/meta/llama-3.1-8b-instruct-fast","WORKERS_AI_TRANSCRIPTION_MODEL":"@cf/openai/whisper-large-v3-turbo","OPENAI_TEXT_MODEL":"gpt-5.6-luna","OPENAI_TRANSCRIPTION_MODEL":"gpt-4o-transcribe","ANTHROPIC_TEXT_MODEL":"claude-sonnet-5","AGENT_WORKER_URL":"https://yrak-suterm-agents.yrak-suterm.workers.dev"},
  "ai":{"binding":"AI"},"d1_databases":[{"binding":"DB","database_name":"yrak-suterm-coberturas","database_id":"bf353405-5422-4b9d-a11d-c8a8a813a4b6","migrations_dir":"../../migrations"}],"r2_buckets":[{"binding":"EVIDENCE_BUCKET","bucket_name":"yrak-suterm-evidence"}],"durable_objects":{"bindings":[{"name":"GROUP_COORDINATOR","class_name":"GroupCoordinator"}]},"exports":{"GroupCoordinator":{"type":"durable-object","storage":"sqlite"}},"workflows":[{"name":"yrak-coverage-workflow","binding":"COVERAGE_WORKFLOW","class_name":"CoverageWorkflow"}],"queues":{"producers":[{"binding":"NOTIFICATIONS_QUEUE","queue":"yrak-notifications"}],"consumers":[{"queue":"yrak-notifications","max_batch_size":10,"max_retries":5}]},"send_email":[{"name":"EMAIL"}],"triggers":{"crons":["* * * * *"]},
  "env":{
    "demo":{
      "name":"yrak-suterm-coberturas-api-demo",
      "vars":{"APP_ENV":"development","DEFAULT_TIMEZONE":"America/Mexico_City","PUBLIC_BASE_URL":"https://yrak-suterm-coberturas-api-demo.yrak-suterm.workers.dev","EMAIL_FROM":"REPLACE_WITH_VERIFIED_SENDER","INBOUND_EMAIL_ORGANIZATION_ID":"demo-cfe","AI_PROVIDER":"compatible","AI_COMPAT_PROVIDER_ID":"nvidia-nim","AI_COMPAT_BASE_URL":"https://integrate.api.nvidia.com/v1","AI_COMPAT_TEXT_MODEL":"deepseek-ai/deepseek-v4-flash-0731","AI_REQUEST_TIMEOUT_MS":"30000","WORKERS_AI_TEXT_MODEL":"@cf/meta/llama-3.1-8b-instruct-fast","WORKERS_AI_TRANSCRIPTION_MODEL":"@cf/openai/whisper-large-v3-turbo","OPENAI_TEXT_MODEL":"gpt-5.6-luna","OPENAI_TRANSCRIPTION_MODEL":"gpt-4o-transcribe","ANTHROPIC_TEXT_MODEL":"claude-sonnet-5","AGENT_WORKER_URL":"https://yrak-suterm-agents-demo.yrak-suterm.workers.dev"},
      "ai":{"binding":"AI"},"d1_databases":[{"binding":"DB","database_name":"yrak-suterm-demo","database_id":"REPLACE_WITH_DEMO_D1_ID","migrations_dir":"../../migrations"}],"r2_buckets":[{"binding":"EVIDENCE_BUCKET","bucket_name":"yrak-suterm-demo-evidence"}],"durable_objects":{"bindings":[{"name":"GROUP_COORDINATOR","class_name":"GroupCoordinator"}]},"workflows":[{"name":"yrak-demo-coverage-workflow","binding":"COVERAGE_WORKFLOW","class_name":"CoverageWorkflow"}],"queues":{"producers":[{"binding":"NOTIFICATIONS_QUEUE","queue":"yrak-notifications-demo"}],"consumers":[{"queue":"yrak-notifications-demo","max_batch_size":10,"max_retries":5}]},"send_email":[{"name":"EMAIL"}],"triggers":{"crons":["* * * * *"]}
    }
  }
}
```

`REPLACE_WITH_DEMO_D1_ID` se reemplaza con el id real devuelto por `wrangler d1 create` en el Step 3 — este placeholder es intencional (mismo patrón que el repo ya usa en `docs/CONNECTIONS.md` para IDs generados en tiempo de ejecución, no un TODO de diseño).

- [ ] **Step 2: Agregar `env.demo` a `apps/agent-worker/wrangler.jsonc`**

Reemplazar el contenido completo por:

```jsonc
{"$schema":"node_modules/wrangler/config-schema.json","name":"yrak-suterm-agents","main":"src/index.ts","compatibility_date":"2026-08-07","observability":{"enabled":true},"vars":{"AGENT_ORGANIZATION_ID":"suterm-cfe","WORKERS_AI_TEXT_MODEL":"@cf/meta/llama-3.1-8b-instruct-fast","WORKERS_AI_TRANSCRIPTION_MODEL":"@cf/openai/whisper-large-v3-turbo","AI_PROFILE":"production","ANTHROPIC_TEXT_MODEL":"claude-sonnet-5","AI_COMPAT_PROVIDER_ID":"nvidia-nim","AI_COMPAT_BASE_URL":"https://integrate.api.nvidia.com/v1","AI_COMPAT_TEXT_MODEL":"deepseek-ai/deepseek-v4-flash-0731","AI_MAX_PROVIDER_ATTEMPTS":"2","AI_REQUEST_TIMEOUT_MS":"30000"},"ai":{"binding":"AI"},"d1_databases":[{"binding":"DB","database_name":"yrak-suterm-coberturas","database_id":"bf353405-5422-4b9d-a11d-c8a8a813a4b6"}],"durable_objects":{"bindings":[{"name":"AGENT_SESSION","class_name":"YrakAgentSession"}]},"exports":{"YrakAgentSession":{"type":"durable-object","storage":"sqlite"}},
"env":{"demo":{"name":"yrak-suterm-agents-demo","vars":{"AGENT_ORGANIZATION_ID":"demo-cfe","WORKERS_AI_TEXT_MODEL":"@cf/meta/llama-3.1-8b-instruct-fast","WORKERS_AI_TRANSCRIPTION_MODEL":"@cf/openai/whisper-large-v3-turbo","AI_PROFILE":"production","ANTHROPIC_TEXT_MODEL":"claude-sonnet-5","AI_COMPAT_PROVIDER_ID":"nvidia-nim","AI_COMPAT_BASE_URL":"https://integrate.api.nvidia.com/v1","AI_COMPAT_TEXT_MODEL":"deepseek-ai/deepseek-v4-flash-0731","AI_MAX_PROVIDER_ATTEMPTS":"2","AI_REQUEST_TIMEOUT_MS":"30000"},"ai":{"binding":"AI"},"d1_databases":[{"binding":"DB","database_name":"yrak-suterm-demo","database_id":"REPLACE_WITH_DEMO_D1_ID"}],"durable_objects":{"bindings":[{"name":"AGENT_SESSION","class_name":"YrakAgentSession"}]}}}}
```

- [ ] **Step 3: Crear los recursos Cloudflare del demo**

Exportar credenciales (ya están en el scratchpad de esta sesión) y crear D1, R2, Queue:

```bash
export CLOUDFLARE_API_TOKEN=<del scratchpad> CLOUDFLARE_ACCOUNT_ID=<del scratchpad>
cd apps/api-worker
npx wrangler d1 create yrak-suterm-demo
# copiar el database_id devuelto y reemplazar REPLACE_WITH_DEMO_D1_ID en AMBOS wrangler.jsonc (api-worker y agent-worker)
npx wrangler r2 bucket create yrak-suterm-demo-evidence
npx wrangler queues create yrak-notifications-demo
```

- [ ] **Step 4: Aplicar las 20 migraciones al D1 demo**

```bash
npx wrangler d1 migrations apply yrak-suterm-demo --env demo --remote
```

Expected: aplica `0001_core.sql` .. `0020_calendar_settings.sql` (20 archivos, contando el gap de numeración 0013 que no existe).

- [ ] **Step 5: Generar y guardar secrets nuevos del demo — SOLO en el scratchpad**

```bash
DEMO_DEV_AUTH_TOKEN=$(openssl rand -hex 24)
DEMO_AGENT_API_TOKEN=$(openssl rand -hex 24)
DEMO_BOOTSTRAP_TOKEN=$(openssl rand -hex 24)
```

Anexar al scratchpad `yrak-credenciales.md` (nunca al repo):
```
## Entorno DEMO (Task B1)
DEMO_DEV_AUTH_TOKEN=<valor generado>
DEMO_AGENT_API_TOKEN=<valor generado>
DEMO_BOOTSTRAP_TOKEN=<valor generado>
DEMO_D1_ID=<database_id de wrangler d1 create>
```

- [ ] **Step 6: Poner los secrets en ambos workers demo**

```bash
cd apps/api-worker
echo "$DEMO_DEV_AUTH_TOKEN" | npx wrangler secret put DEV_AUTH_TOKEN --env demo
echo "$DEMO_BOOTSTRAP_TOKEN" | npx wrangler secret put BOOTSTRAP_TOKEN --env demo
echo "$DEMO_AGENT_API_TOKEN" | npx wrangler secret put AGENT_API_TOKEN --env demo
# Gmail: mismas credenciales que producción (correos reales)
grep GMAIL_ scratchpad-path/yrak-credenciales.md # leer valores
npx wrangler secret put GMAIL_CLIENT_ID --env demo
npx wrangler secret put GMAIL_CLIENT_SECRET --env demo
npx wrangler secret put GMAIL_REFRESH_TOKEN --env demo
npx wrangler secret put GMAIL_SENDER --env demo
npx wrangler secret put AI_COMPAT_API_KEY --env demo # mismo NVIDIA_NIM_API_KEY del scratchpad

cd ../agent-worker
echo "$DEMO_AGENT_API_TOKEN" | npx wrangler secret put AGENT_API_TOKEN --env demo
npx wrangler secret put AI_COMPAT_API_KEY --env demo
```

- [ ] **Step 7: Desplegar ambos workers demo**

```bash
cd apps/api-worker && npx wrangler deploy --env demo
cd ../agent-worker && npx wrangler deploy --env demo
```

- [ ] **Step 8: Bootstrap de la organización demo**

```bash
curl -s -X POST https://yrak-suterm-coberturas-api-demo.yrak-suterm.workers.dev/bootstrap \
  -H "x-yrak-bootstrap-token: $DEMO_BOOTSTRAP_TOKEN" -H "content-type: application/json" \
  -d '{"organizationId":"demo-cfe","organizationName":"CFE Demo","timezone":"America/Mexico_City","adminEmail":"yrakelizalde9@gmail.com","adminDisplayName":"Admin Demo"}'
```

Expected: `201` con el `id` del admin. Guardar en el scratchpad.

- [ ] **Step 9: Crear las Pages del demo**

```bash
cd apps/admin-web
VITE_API_BASE_URL=https://yrak-suterm-coberturas-api-demo.yrak-suterm.workers.dev pnpm build
npx wrangler pages deploy dist --project-name yrak-admin-web-demo

cd ../employee-portal
VITE_API_BASE_URL=https://yrak-suterm-coberturas-api-demo.yrak-suterm.workers.dev pnpm build
npx wrangler pages deploy dist --project-name yrak-employee-portal-demo
```

- [ ] **Step 10: Agregar los orígenes `-demo` al CORS allowlist**

En `apps/api-worker/src/index.ts` línea 2, reemplazar `ALLOWED_ORIGINS`:

```ts
const ALLOWED_ORIGIN_SUFFIXES=['.yrak-admin-web.pages.dev','.yrak-employee-portal.pages.dev'];const ALLOWED_ORIGINS=new Set(['https://yrak-admin-web.pages.dev','https://yrak-employee-portal.pages.dev','https://yrak-admin-web-demo.pages.dev','https://yrak-employee-portal-demo.pages.dev','http://localhost:5173','http://localhost:5174','http://localhost:5175','http://localhost:5176']);function isAllowedOrigin(origin:string):boolean{if(ALLOWED_ORIGINS.has(origin))return true;return ALLOWED_ORIGIN_SUFFIXES.some(suffix=>origin.endsWith(suffix)&&origin.startsWith('https://'));}
```

Nota: `ALLOWED_ORIGIN_SUFFIXES` usa `.endsWith(suffix)`, y `yrak-admin-web-demo.pages.dev` NO es un subdominio de `yrak-admin-web.pages.dev` (es un proyecto Pages distinto con su propio `*.pages.dev`), por eso se agrega explícito a `ALLOWED_ORIGINS` en vez de confiar en el sufijo.

- [ ] **Step 11: Crear `scripts/demo/deploy-demo.sh` — redeploy repetible de ambos workers + ambas Pages**

```bash
#!/usr/bin/env bash
# Redeploy the full demo environment (api-worker, agent-worker, both Pages)
# after a code change. Assumes CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID
# are exported and the demo D1/R2/Queue already exist (see Task B1).
set -euo pipefail
: "${CLOUDFLARE_API_TOKEN:?export CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_ACCOUNT_ID:?export CLOUDFLARE_ACCOUNT_ID}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_URL="https://yrak-suterm-coberturas-api-demo.yrak-suterm.workers.dev"

echo "== api-worker (demo) ==" >&2
(cd "$ROOT_DIR/apps/api-worker" && npx wrangler deploy --env demo)

echo "== agent-worker (demo) ==" >&2
(cd "$ROOT_DIR/apps/agent-worker" && npx wrangler deploy --env demo)

echo "== admin-web (demo) ==" >&2
(cd "$ROOT_DIR/apps/admin-web" && VITE_API_BASE_URL="$API_URL" pnpm build && npx wrangler pages deploy dist --project-name yrak-admin-web-demo)

echo "== employee-portal (demo) ==" >&2
(cd "$ROOT_DIR/apps/employee-portal" && VITE_API_BASE_URL="$API_URL" pnpm build && npx wrangler pages deploy dist --project-name yrak-employee-portal-demo)

echo "Demo redeploy completo. $API_URL" >&2
```

```bash
chmod +x scripts/demo/deploy-demo.sh
```

- [ ] **Step 12: Verificar el entorno demo end-to-end**

```bash
curl -s https://yrak-suterm-coberturas-api-demo.yrak-suterm.workers.dev/health
curl -s https://yrak-suterm-coberturas-api-demo.yrak-suterm.workers.dev/ready
curl -s -o /dev/null -w "%{http_code}\n" https://yrak-admin-web-demo.pages.dev
curl -s -o /dev/null -w "%{http_code}\n" https://yrak-employee-portal-demo.pages.dev
```

Expected: `{"ok":true,...}` en ambos, `200` en ambas Pages.

- [ ] **Step 13: Gates + Commit**

```bash
pnpm typecheck && pnpm test && pnpm build
git add apps/api-worker/wrangler.jsonc apps/agent-worker/wrangler.jsonc scripts/demo/deploy-demo.sh
git commit -m "$(cat <<'EOF'
feat: entorno demo separado en Cloudflare (env.demo)

Agrega env.demo a los wrangler.jsonc de api-worker y agent-worker
(mismo código, recursos Cloudflare completamente separados: D1
yrak-suterm-demo, R2 yrak-suterm-demo-evidence, Queue
yrak-notifications-demo, org demo-cfe). Cero recursos compartidos con
producción. CORS actualizado con los orígenes -demo.pages.dev
(proyectos Pages distintos, no subdominios, por eso se agregan
explícitos en vez de por sufijo). Secrets del demo (DEV_AUTH_TOKEN,
BOOTSTRAP_TOKEN, AGENT_API_TOKEN) son valores nuevos, distintos a
producción; Gmail y NVIDIA NIM reusan las credenciales existentes.

Constraint: cero escrituras al D1 de producción durante todo este plan
Confidence: high
Scope-risk: moderate — toca wrangler.jsonc de dos workers en producción, pero solo agrega la clave env.demo, no modifica los defaults existentes
Not-tested: failover/rollback del entorno demo (no aplica, es descartable y recreable con este mismo script)
EOF
)"
```

---

### Task B2: Seed ficticio completo vía API

**Files:**
- Create: `scripts/demo/seed-demo.sh`
- Create: `scripts/demo/reset-demo.sh`
- Create: `examples/demo/catalog.json`
- Create: `examples/demo/employees.json`
- Create: `examples/demo/requirements.json`
- Create: `examples/demo/users.json`

**Interfaces:**
- Consumes: todos los endpoints `/v1/config/*`, `/v1/employees`, `/v1/import/*`, `/v1/policies/groups/:groupId/coverage`, `/v1/calendar/*` (Tasks A2 + ya existentes).
- Produces: datos reales en el D1 demo, consumidos por Task B3 (guión) y B4 (ejecución de matriz).

- [ ] **Step 1: `examples/demo/catalog.json` — 2 grupos, niveles 5-8, transiciones**

```json
{
  "groups": [
    {
      "id": "demo-grupo-distribucion",
      "name": "Distribución Demo",
      "description": "Grupo ficticio para el demo — Distribución",
      "levels": [
        { "id": "demo-dist-n5", "number": 5, "name": "Nivel 5", "rankOrder": 1 },
        { "id": "demo-dist-n6", "number": 6, "name": "Nivel 6", "rankOrder": 2 },
        { "id": "demo-dist-n7", "number": 7, "name": "Nivel 7", "rankOrder": 3 },
        { "id": "demo-dist-n8", "number": 8, "name": "Nivel 8", "rankOrder": 4 }
      ],
      "transitions": [
        { "sourceLevelId": "demo-dist-n5", "targetLevelId": "demo-dist-n6" },
        { "sourceLevelId": "demo-dist-n6", "targetLevelId": "demo-dist-n7" },
        { "sourceLevelId": "demo-dist-n7", "targetLevelId": "demo-dist-n8" }
      ]
    },
    {
      "id": "demo-grupo-comercial",
      "name": "Comercial Demo",
      "description": "Grupo ficticio para el demo — Comercial",
      "levels": [
        { "id": "demo-com-n5", "number": 5, "name": "Nivel 5", "rankOrder": 1 },
        { "id": "demo-com-n6", "number": 6, "name": "Nivel 6", "rankOrder": 2 },
        { "id": "demo-com-n7", "number": 7, "name": "Nivel 7", "rankOrder": 3 },
        { "id": "demo-com-n8", "number": 8, "name": "Nivel 8", "rankOrder": 4 }
      ],
      "transitions": [
        { "sourceLevelId": "demo-com-n5", "targetLevelId": "demo-com-n6" },
        { "sourceLevelId": "demo-com-n6", "targetLevelId": "demo-com-n7" },
        { "sourceLevelId": "demo-com-n7", "targetLevelId": "demo-com-n8" }
      ]
    }
  ]
}
```

- [ ] **Step 2: `examples/demo/employees.json` — 10 empleados ficticios**

```json
{
  "items": [
    { "id": "demo-emp-01", "employeeNumber": "D-001", "name": "Ana Torres (DEMO)", "groupId": "demo-grupo-distribucion", "baseLevelId": "demo-dist-n7", "seniorityDate": "2012-03-01" },
    { "id": "demo-emp-02", "employeeNumber": "D-002", "name": "Luis Ramírez (DEMO)", "groupId": "demo-grupo-distribucion", "baseLevelId": "demo-dist-n7", "seniorityDate": "2015-06-15" },
    { "id": "demo-emp-03", "employeeNumber": "D-003", "name": "María Gómez (DEMO)", "groupId": "demo-grupo-distribucion", "baseLevelId": "demo-dist-n7", "seniorityDate": "2018-01-10" },
    { "id": "demo-emp-04", "employeeNumber": "D-004", "name": "Jorge Salas (DEMO)", "groupId": "demo-grupo-distribucion", "baseLevelId": "demo-dist-n7", "seniorityDate": "2020-09-20" },
    { "id": "demo-emp-05", "employeeNumber": "D-005", "name": "Sofía Herrera (DEMO)", "groupId": "demo-grupo-distribucion", "baseLevelId": "demo-dist-n7", "seniorityDate": "2022-02-01" },
    { "id": "demo-emp-06", "employeeNumber": "D-006", "name": "Carlos Peña (DEMO)", "groupId": "demo-grupo-distribucion", "baseLevelId": "demo-dist-n7", "seniorityDate": "2024-04-11" },
    { "id": "demo-emp-07", "employeeNumber": "C-001", "name": "Diana Ruiz (DEMO)", "groupId": "demo-grupo-comercial", "baseLevelId": "demo-com-n7", "seniorityDate": "2013-07-01" },
    { "id": "demo-emp-08", "employeeNumber": "C-002", "name": "Roberto Díaz (DEMO)", "groupId": "demo-grupo-comercial", "baseLevelId": "demo-com-n7", "seniorityDate": "2017-05-05" },
    { "id": "demo-emp-09", "employeeNumber": "C-003", "name": "Patricia Luna (DEMO)", "groupId": "demo-grupo-comercial", "baseLevelId": "demo-com-n7", "seniorityDate": "2019-11-30" },
    { "id": "demo-emp-10", "employeeNumber": "C-004", "name": "Fernando Cruz (DEMO)", "groupId": "demo-grupo-comercial", "baseLevelId": "demo-com-n7", "seniorityDate": "2023-08-14" }
  ]
}
```

`email` se omite aquí a propósito: `scripts/demo/seed-demo.sh` (Step 5) lo asigna en tiempo de ejecución con el patrón `+alias` sobre el correo real del operador, igual que `seed-production.sh` — así los 10 empleados ficticios reciben sus correos de oferta en el mismo buzón real verificable.

- [ ] **Step 3: `examples/demo/requirements.json` — 2 requisitos**

```json
{
  "items": [
    { "id": "demo-req-curso-n8", "name": "Curso Nivel 8 (DEMO)", "requirementType": "COURSE", "validityDays": null },
    { "id": "demo-req-cert-seguridad", "name": "Certificación Seguridad (DEMO)", "requirementType": "CERTIFICATION", "validityDays": 365 }
  ]
}
```

- [ ] **Step 4: `examples/demo/users.json` — 1 ADMIN, 1 SUPERVISOR (solo Distribución), 4 EMPLOYEE**

```json
{
  "items": [
    { "id": "demo-user-supervisor", "displayName": "Supervisor Distribución (DEMO)", "role": "SUPERVISOR", "employeeId": null, "groupIds": ["demo-grupo-distribucion"] }
  ]
}
```

Solo el SUPERVISOR va en JSON estático (su email se genera en el script, igual que los EMPLOYEE, para llegar al buzón real). El ADMIN ya existe desde el bootstrap (Task B1 Step 8).

- [ ] **Step 5: `scripts/demo/seed-demo.sh` — orquesta todo, vía API, idempotente**

```bash
#!/usr/bin/env bash
# Seed the fictional demo dataset via the demo api-worker's HTTP API.
# Required env vars:
#   YRAK_API_BASE      https://yrak-suterm-coberturas-api-demo.yrak-suterm.workers.dev
#   YRAK_USER_EMAIL     the real inbox that receives all demo offer emails
#   YRAK_DEV_TOKEN      the DEMO_DEV_AUTH_TOKEN from the scratchpad
set -euo pipefail
: "${YRAK_API_BASE:?set YRAK_API_BASE}"
: "${YRAK_USER_EMAIL:?set YRAK_USER_EMAIL}"
: "${YRAK_DEV_TOKEN:?set YRAK_DEV_TOKEN}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXAMPLES="$ROOT_DIR/examples/demo"
ALIAS_BASE="${YRAK_USER_EMAIL%%@*}"
ALIAS_DOMAIN="${YRAK_USER_EMAIL#*@}"

curl_json() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "${YRAK_API_BASE}${path}" -H "content-type: application/json" \
      -H "x-yrak-user-email: ${YRAK_USER_EMAIL}" -H "x-yrak-dev-token: ${YRAK_DEV_TOKEN}" -d "$body"
  else
    curl -sS -X "$method" "${YRAK_API_BASE}${path}" \
      -H "x-yrak-user-email: ${YRAK_USER_EMAIL}" -H "x-yrak-dev-token: ${YRAK_DEV_TOKEN}"
  fi
}

echo "== [1/9] Catálogo (2 grupos, niveles, transiciones) ==" >&2
curl_json POST /v1/import/catalog "$(jq -c '{groups}' "$EXAMPLES/catalog.json")" | jq -c .

echo "== [2/9] Empleados (con email +alias real) ==" >&2
EMP_JSON=$(jq -c --arg base "$ALIAS_BASE" --arg domain "$ALIAS_DOMAIN" \
  '{items: [.items[] | . + {email: ($base + "+" + .id + "@" + $domain)}]}' "$EXAMPLES/employees.json")
curl_json POST /v1/import/employees "$EMP_JSON" | jq -c .

echo "== [3/9] Requisitos ==" >&2
curl_json POST /v1/import/requirements "$(cat "$EXAMPLES/requirements.json")" | jq -c .

echo "== [4/9] Mapear requisitos al Nivel 8 de Distribución (mandatory=1) ==" >&2
curl_json PUT /v1/config/levels/demo-dist-n8/requirements/demo-req-curso-n8 '{"mandatory":true,"validForEntireCoverage":true}' | jq -c .
curl_json PUT /v1/config/levels/demo-dist-n8/requirements/demo-req-cert-seguridad '{"mandatory":true,"validForEntireCoverage":true}' | jq -c .

echo "== [5/9] Cumplimiento mixto deliberado (ELG-01/02/03) ==" >&2
# demo-emp-01..02: COMPLIANT vigente (elegibles)
# demo-emp-03: COMPLIANT pero vence a mitad de una cobertura de ejemplo (ELG-03)
# demo-emp-04: EXPIRED (para ver el barrido cron y ELG-02)
# demo-emp-05..06: MISSING (nunca se registra -> ELG-01, no requiere llamada)
curl_json POST /v1/import/employee-requirements "$(jq -nc '{items:[
  {employeeId:"demo-emp-01",requirementId:"demo-req-curso-n8",status:"COMPLIANT",completedAt:"2025-01-10",validUntil:"2027-01-10"},
  {employeeId:"demo-emp-01",requirementId:"demo-req-cert-seguridad",status:"COMPLIANT",completedAt:"2025-06-01",validUntil:"2026-06-01"},
  {employeeId:"demo-emp-02",requirementId:"demo-req-curso-n8",status:"COMPLIANT",completedAt:"2025-02-15",validUntil:"2027-02-15"},
  {employeeId:"demo-emp-02",requirementId:"demo-req-cert-seguridad",status:"COMPLIANT",completedAt:"2025-07-01",validUntil:"2026-07-01"},
  {employeeId:"demo-emp-03",requirementId:"demo-req-curso-n8",status:"COMPLIANT",completedAt:"2025-01-01",validUntil:"2027-01-01"},
  {employeeId:"demo-emp-03",requirementId:"demo-req-cert-seguridad",status:"COMPLIANT",completedAt:"2025-01-01",validUntil:"2026-09-05"},
  {employeeId:"demo-emp-04",requirementId:"demo-req-curso-n8",status:"EXPIRED",completedAt:"2023-01-01",validUntil:"2025-01-01"}
]}')" | jq -c .

echo "== [6/9] Usuarios: SUPERVISOR (solo Distribución) + EMPLOYEE x10 (+alias) ==" >&2
SUP_EMAIL="${ALIAS_BASE}+demo-user-supervisor@${ALIAS_DOMAIN}"
curl_json POST /v1/import/users "$(jq -nc --arg email "$SUP_EMAIL" '{items:[{id:"demo-user-supervisor",email:$email,displayName:"Supervisor Distribución (DEMO)",role:"SUPERVISOR",groupIds:["demo-grupo-distribucion"]}]}')" | jq -c .
EMP_USERS=$(jq -c --arg base "$ALIAS_BASE" --arg domain "$ALIAS_DOMAIN" \
  '{items: [.items[] | {id: ("user-" + .id), email: ($base + "+" + .id + "@" + $domain), displayName: .name, role: "EMPLOYEE", employeeId: .id, groupIds: [.groupId]}]}' "$EXAMPLES/employees.json")
curl_json POST /v1/import/users "$EMP_USERS" | jq -c .

echo "== [7/9] Pools de rotación 7->8 en ambos grupos ==" >&2
curl_json POST /v1/config/rotation-pools "$(jq -nc '{groupId:"demo-grupo-distribucion",sourceLevelId:"demo-dist-n7",targetLevelId:"demo-dist-n8",employeeIds:["demo-emp-01","demo-emp-02","demo-emp-03","demo-emp-04","demo-emp-05","demo-emp-06"]}')" | jq -c .
curl_json POST /v1/config/rotation-pools "$(jq -nc '{groupId:"demo-grupo-comercial",sourceLevelId:"demo-com-n7",targetLevelId:"demo-com-n8",employeeIds:["demo-emp-07","demo-emp-08","demo-emp-09","demo-emp-10"]}')" | jq -c .

echo "== [8/9] Política demo (timer 2min, cascada, WORKING_DAYS) para ambos grupos ==" >&2
POLICY='{"dayCountingMode":"WORKING_DAYS","rejectionConsumesTurn":true,"cascadeEnabled":true,"cascadeMaximumDepth":3,"rotationOfferTimeoutMinutes":2,"effectiveFrom":"2020-01-01"}'
curl_json POST /v1/policies/groups/demo-grupo-distribucion/coverage "$POLICY" | jq -c .
curl_json POST /v1/policies/groups/demo-grupo-comercial/coverage "$POLICY" | jq -c .

echo "== [9/9] Feriados MX + semana laboral 6 días para Comercial ==" >&2
curl_json POST /v1/import/holidays "$(cat "$EXAMPLES/holidays.json")" | jq -c .
curl_json PUT /v1/calendar/settings/demo-grupo-comercial '{"workingWeekdays":[1,2,3,4,5,6],"effectiveFrom":"2020-01-01"}' | jq -c .

echo "== Indisponibilidad de ejemplo (demo-emp-05, exclusión de candidato) ==" >&2
curl_json POST /v1/employees/demo-emp-05/unavailability '{"kind":"VACATION","startDate":"2026-09-01","endDate":"2026-09-10","reason":"Vacaciones (DEMO)"}' | jq -c .

echo "Seed completo." >&2
echo "SUPERVISOR_EMAIL=$SUP_EMAIL"
echo "EMPLOYEE_EMAILS=${ALIAS_BASE}+demo-emp-01@${ALIAS_DOMAIN} .. ${ALIAS_BASE}+demo-emp-10@${ALIAS_DOMAIN}"
```

Nota sobre `examples/demo/holidays.json`: ya creado en Task A3 Step 4 con la estructura `{"items":[...]}` — este script lo reutiliza directamente para `/v1/import/holidays`.

```bash
chmod +x scripts/demo/seed-demo.sh
```

- [ ] **Step 6: `scripts/demo/reset-demo.sh` — borra datos transaccionales y re-siembra**

```bash
#!/usr/bin/env bash
# Wipe transactional demo data (keeps catalog/employees/requirements/users)
# and re-run the seed. Makes the demo repeatable in minutes before each run.
set -euo pipefail
: "${CLOUDFLARE_API_TOKEN:?export CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_ACCOUNT_ID:?export CLOUDFLARE_ACCOUNT_ID}"

cd "$(dirname "${BASH_SOURCE[0]}")/../../apps/api-worker"
npx wrangler d1 execute yrak-suterm-demo --env demo --remote --command "
DELETE FROM notifications;
DELETE FROM coverage_candidate_responses;
DELETE FROM coverage_candidate_evaluations;
DELETE FROM rotation_events;
DELETE FROM temporary_assignments;
DELETE FROM appeals;
DELETE FROM competition_score_revisions;
DELETE FROM competition_candidates;
DELETE FROM competitions;
DELETE FROM coverage_cases;
UPDATE rotation_queue_entries SET status='AVAILABLE', queue_position=(SELECT COUNT(*) FROM rotation_queue_entries r2 WHERE r2.pool_id=rotation_queue_entries.pool_id AND r2.employee_id<=rotation_queue_entries.employee_id);
"
echo "Datos transaccionales del demo borrados. Re-corriendo seed..." >&2
cd -
"$(dirname "${BASH_SOURCE[0]}")/seed-demo.sh"
```

```bash
chmod +x scripts/demo/reset-demo.sh
```

- [ ] **Step 7: Ejecutar el seed contra el entorno demo real**

```bash
export YRAK_API_BASE=https://yrak-suterm-coberturas-api-demo.yrak-suterm.workers.dev
export YRAK_USER_EMAIL=yrakelizalde9@gmail.com
export YRAK_DEV_TOKEN=<DEMO_DEV_AUTH_TOKEN del scratchpad>
./scripts/demo/seed-demo.sh
```

- [ ] **Step 8: Verificar el seed**

```bash
curl -s "$YRAK_API_BASE/v1/employees" -H "x-yrak-user-email: $YRAK_USER_EMAIL" -H "x-yrak-dev-token: $YRAK_DEV_TOKEN" | jq '.items | length'
```

Expected: `10`. Verificar también que `/v1/calendar/holidays` devuelve 14 filas y `/v1/calendar/settings/demo-grupo-comercial` devuelve `workingWeekdays:[1,2,3,4,5,6]`.

- [ ] **Step 9: Gates + Commit**

```bash
pnpm typecheck && pnpm test && pnpm build
git add scripts/demo/seed-demo.sh scripts/demo/reset-demo.sh examples/demo/catalog.json examples/demo/employees.json examples/demo/requirements.json examples/demo/users.json
git commit -m "$(cat <<'EOF'
feat: seed ficticio completo del demo (10 empleados, 2 grupos, requisitos con fallos deliberados)

scripts/demo/seed-demo.sh siembra vía API (nunca SQL directo, mismo
patrón que seed-production.sh): 2 grupos, 10 empleados con antigüedades
2012-2024, 2 requisitos mapeados al Nivel 8 de Distribución con
cumplimiento mixto deliberado (2 COMPLIANT vigentes, 1 vence a mitad de
cobertura, 1 EXPIRED, 2 MISSING) para ejercitar ELG-01/02/03 sin datos
reales. 1 SUPERVISOR solo con acceso a Distribución (para GROUP_FORBIDDEN
/ SEC-01), pools de rotación en ambos grupos, política con timer de 2min
y cascada encendida, feriados MX y semana laboral de 6 días en Comercial.
reset-demo.sh permite repetir el demo en minutos sin re-crear catálogo.

Confidence: high
Scope-risk: narrow — todo contenido va al D1 demo, cero contacto con producción
Not-tested: reset-demo.sh no se ejecutó todavía en esta tarea (se ejercita en Task B3/B4 antes de cada ensayo del guión)
EOF
)"
```

---

### Task B3: Guión de demo profesional + catálogo de fallos

**Files:**
- Create: `docs/DEMO_RUNBOOK.md`

**Interfaces:**
- Consumes: URLs y datos de Task B1/B2 (grupos, empleados, política demo).

- [ ] **Step 1: Escribir `docs/DEMO_RUNBOOK.md` con la estructura completa de 5 actos**

```markdown
# Guión de demo — YRAK SUTERM Coberturas (entorno demo)

**URLs del demo:**
- API: https://yrak-suterm-coberturas-api-demo.yrak-suterm.workers.dev
- Dashboard: https://yrak-admin-web-demo.pages.dev
- Portal del trabajador: https://yrak-employee-portal-demo.pages.dev

**Antes de cada ensayo:** `./scripts/demo/reset-demo.sh` (deja los datos ficticios frescos, sin coberturas/notificaciones de una corrida anterior).

**Login:** correo `yrakelizalde9@gmail.com` (Secretario/ADMIN) o cualquier `yrakelizalde9+demo-emp-XX@gmail.com` (empleado), token `DEMO_DEV_AUTH_TOKEN` del scratchpad.

---

## Acto 1 — Configuración y calendario (5 min)

| Paso | Acción | Resultado esperado | Qué decir |
|---|---|---|---|
| 1.1 | Dashboard → Calendario → Vista previa: grupo Distribución, 2026-09-03 a 2026-09-10 (lunes a lunes, 8 días naturales) | `8 días → CONCURSO` | "Sin feriado ni fin de semana excluido, 8 días es concurso — regla dura del negocio: 6+ requiere examen." |
| 1.2 | Agregar feriado temporal 2026-09-04/05/06 al grupo Distribución, repetir la misma vista previa | `~5 días → ROTACIÓN` | "El mismo rango de fechas cambia de clasificación según el calendario real del grupo — sin tocar código, sin SQL." |
| 1.3 | Borrar el feriado temporal (limpieza) | vuelve a 8 días | — |
| 1.4 | Calendario → semana laboral de Comercial → mostrar 6 días marcados (L-S) | preview de Comercial cuenta sábados | "Comercial trabaja 6 días; Distribución 5 — cada grupo tiene su propia semana, versionada y auditada." |
| 1.5 | Configuración → cambiar `rotationOfferTimeoutMinutes` de Comercial a 3 y volver a 2 | nueva versión de política, ambas visibles en auditoría | "Cada cambio de regla queda versionado con fecha de vigencia — nunca se sobreescribe silenciosamente." |

## Acto 2 — Rotación corta con correo real (10 min)

| Paso | Acción | Resultado esperado |
|---|---|---|
| 2.1 | Coberturas → Nuevo expediente: grupo Distribución, nivel 8, 2026-09-03 a 2026-09-04 (2 días hábiles) | `ROTATION`, `PENDING_VALIDATION` |
| 2.2 | Cargar el expediente → "Seleccionar rotación" | candidato con menor `queue_position` elegible ofertado, `CANDIDATES_CALCULATED` |
| 2.3 | Revisar el correo real recibido (Aceptar/Rechazar, vence en 2:00) | correo con botones firmados |
| 2.4 | Abrir el portal del trabajador con la sesión del empleado ofertado | "Mis Ofertas" muestra countdown en vivo desde 2:00 |
| 2.5 | Click "Aceptar" desde el correo | `SCHEDULED`; si `cascadeEnabled`, se abre automáticamente un expediente hijo en el nivel base del aceptante |
| 2.6 | Repetir 2.1-2.2 con otro rango; esta vez **Rechazar** desde el portal | cola reordenada (rechazante al final, `AVAILABLE`); resto del pool sin alterar (fix de Task 7b) |
| 2.7 | Repetir 2.1-2.2 una vez más y **no responder** — esperar 2 minutos | expiración automática → rechazo → siguiente candidato ofertado → segundo correo, sin intervención humana |

## Acto 3 — Concurso 6+ con los 3 fallos de elegibilidad (10 min)

| Paso | Acción | Resultado esperado |
|---|---|---|
| 3.1 | Coberturas → Nuevo expediente: Distribución, nivel 8, 2026-10-05 a 2026-10-14 (8 días hábiles) | `COMPETITION` |
| 3.2 | Concursos → "Evaluar requisitos" con el `caseId` | demo-emp-05/06 → `INELIGIBLE` (`MISSING`, ELG-01); demo-emp-04 → `INELIGIBLE` (`EXPIRED`, ELG-02); demo-emp-03 → depende de si `validUntil` cae antes del fin de cobertura (ELG-03); demo-emp-01/02 → `ELIGIBLE` |
| 3.3 | Participación: aceptar para los elegibles | `accepted_participation=1` |
| 3.4 | Capturar calificaciones (ej. 88 y 95) | primera captura sin revisión |
| 3.5 | Re-capturar la misma calificación con un valor distinto | `202 pendingApproval`, revisión creada — **doble control** |
| 3.6 | Intentar aprobar la revisión con el MISMO usuario que la creó | `409 SECOND_APPROVER_REQUIRED` — mostrar el error en vivo |
| 3.7 | Aprobar con un segundo usuario/rol | revisión aprobada |
| 3.8 | Confirmar reglas (`PATCH /config`), calcular ranking | ranking por calificación → antigüedad como desempate |
| 3.9 | Abrir una inconformidad sobre el ganador provisional | `appeals` con status `OPEN` |
| 3.10 | Intentar adjudicar (`award`) con la inconformidad abierta | `409 OPEN_APPEALS_BLOCK_AWARD` |
| 3.11 | Resolver la inconformidad, reintentar `award` | asignación `SCHEDULED` |

## Acto 4 — Seguridad y catálogo de fallos (10 min, todo por curl)

```bash
API=https://yrak-suterm-coberturas-api-demo.yrak-suterm.workers.dev
SUP="x-yrak-user-email: yrakelizalde9+demo-user-supervisor@gmail.com"
TOK="x-yrak-dev-token: $DEMO_DEV_AUTH_TOKEN"

# SEC-01 / GROUP_FORBIDDEN — el supervisor de Distribución no puede tocar Comercial
curl -s "$API/v1/coverage-cases?groupId=demo-grupo-comercial" -H "$SUP" -H "$TOK"
# → 400 {"error":"GROUP_FORBIDDEN"}

# SEC-02 — un EMPLOYEE no puede listar todos los expedientes
curl -s "$API/v1/coverage-cases" -H "x-yrak-user-email: yrakelizalde9+demo-emp-01@gmail.com" -H "$TOK"
# → 403 {"error":"FORBIDDEN"}

# Token de oferta inválido / vencido / ya resuelto
curl -s "$API/offers/<assignmentId>/accept?token=tokenInventado"
# → página de error INVALID_TOKEN

# Inmutabilidad de auditoría
curl -s -X POST "$API/../d1-execute-attempt" # (mostrar en su lugar el intento documentado en RUNBOOK_AAH.md — no ejecutable por API pública)

# Idempotency-Key repetido
curl -s -X POST "$API/v1/coverage-cases" -H "$SUP" -H "$TOK" -H "content-type: application/json" -H "idempotency-key: demo-fixed-key-001" -d '{"groupId":"demo-grupo-distribucion","targetLevelId":"demo-dist-n8","startDate":"2026-11-01","endDate":"2026-11-02"}'
curl -s -X POST "$API/v1/coverage-cases" -H "$SUP" -H "$TOK" -H "content-type: application/json" -H "idempotency-key: demo-fixed-key-001" -d '{"groupId":"demo-grupo-distribucion","targetLevelId":"demo-dist-n8","startDate":"2026-11-01","endDate":"2026-11-02"}'
# → segunda respuesta: {"idempotent":true,...} mismo id, sin duplicar

# Bootstrap ya cerrado (guarda single-organization)
curl -s -X POST "$API/bootstrap" -H "x-yrak-bootstrap-token: cualquiera" -d '{}'
# → BOOTSTRAP_ALREADY_COMPLETED
```

Explicar en vivo, sin curl (referenciar la tabla completa en `docs/RELEASE_CANDIDATE.md`): `TARGET_LEVEL_GROUP_MISMATCH`, `NO_ROTATION_CANDIDATE`, `WINNER_NO_LONGER_AVAILABLE`, `ACTIVE_ROTATION_CONSUMED_TURN_REQUIRED`, `LEVEL_TRANSITION_NOT_ALLOWED`, `ROTATION_REJECTION_ONLY_BEFORE_APPROVAL`.

## Acto 5 — IA y cierre (5 min)

| Paso | Acción | Resultado esperado |
|---|---|---|
| 5.1 | Asistente IA → preguntar "¿cuántos días aplican a rotación en Comercial?" | respuesta correcta citando la política vigente de Comercial, memoria de conversación funcionando |
| 5.2 | Documentos/IA → pegar un texto de incidencia de ejemplo → "Crear borrador" | borrador extraído con campos estructurados (grupo/nivel/fechas sugeridos) |
| 5.3 | Reportes → descargar CSV de auditoría | bitácora completa de TODO lo hecho en el demo, exportable |

---

## Checklist previo a cada presentación

- [ ] `./scripts/demo/reset-demo.sh` corrido en los últimos 30 minutos
- [ ] Verificar `GET /health` y `GET /ready` del entorno demo
- [ ] Confirmar acceso al buzón `yrakelizalde9@gmail.com` para mostrar correos en vivo
- [ ] Tener el `caseId`/`assignmentId` de al menos un caso ya en `PROPOSED` como respaldo si el timer de 2 min se vence antes de tiempo durante la demo en vivo
```

- [ ] **Step 2: Ensayar el guión completo una vez de punta a punta**

Correr `reset-demo.sh`, seguir el runbook Acto 1 a 5 literalmente contra las URLs `-demo` reales. Anotar cualquier paso que no funcione como está escrito y corregir el runbook (no el sistema, salvo que se descubra un bug real — en ese caso, tratarlo igual que los hallazgos de Task 7b: documentarlo y decidir si se corrige en este plan o se anota como pendiente).

- [ ] **Step 3: Commit**

```bash
git add docs/DEMO_RUNBOOK.md
git commit -m "$(cat <<'EOF'
docs: guión de demo profesional en 5 actos, ensayado contra el entorno demo real

Cubre calendario en vivo, rotación con correo real (aceptar, rechazar,
expirar con cascada), concurso 6+ con los 3 fallos de elegibilidad
deliberados del seed, catálogo de ~10 escenarios de seguridad/fallo por
curl, y el asistente IA. Ensayado una vez de punta a punta contra las
URLs -demo reales antes de este commit.

Confidence: high
Scope-risk: narrow
EOF
)"
```

---

### Task B4: Ejecutar la matriz pendiente en demo + auditoría + PR

**Files:**
- Create: `docs/DEMO_RESULTS.md`
- Modify: `docs/RELEASE_CANDIDATE.md`
- Modify: `docs/DECISIONES_PENDIENTES.md`

**Interfaces:**
- Consumes: entorno demo completo (Tasks B1-B3), casos de `docs/TEST_MATRIX.md`.

- [ ] **Step 1: Ejecutar contra el demo los casos NO APLICA / NO EJECUTADO de producción**

Correr y registrar evidencia real (ids, respuestas HTTP, queries D1) para: `ELG-01, ELG-02, ELG-03, CMP-01..11, SEC-01, LVL-02, CAS-01, CAS-02, CAS-03, WF-01, WF-02, WF-03, DOC-01, DOC-02, DOC-03, ID-01`.

Para `CAS-03` (cascada hasta nivel sin transición inferior): crear una cobertura en el nivel 5 (el más bajo) y forzar que todo el pool decline, verificar que `NO_ROTATION_CANDIDATE` se lanza en vez de intentar bajar a un nivel 4 inexistente.

Para `DOC-01..03`: subir un PDF/audio de muestra real a `POST /v1/attachments` + `POST /v1/intake/attachments/:id/process`, verificar extracción.

Para `WF-03`: crear una cobertura ROTATION, dejar que el Workflow la lleve a `ACTIVE`, cancelarla a mitad de camino con `activeRotationConsumesTurn`.

- [ ] **Step 2: Escribir `docs/DEMO_RESULTS.md`**

Misma estructura tabular que la sección "Hallazgos de esta auditoría" / tabla de `TEST_MATRIX` en `docs/RELEASE_CANDIDATE.md`: columna ID, PASA/FALLA, evidencia (id real, respuesta, o query D1). Encabezado explicando que corre contra el entorno demo (`demo-cfe`), no producción. `SEC-03/04` se documentan como "cubiertos por la guarda single-organization demostrada en Acto 4 del runbook" (no se crea una segunda organización real, ni en demo ni en producción — el diseño lo impide a propósito).

- [ ] **Step 3: Checklist de seguridad del demo**

```bash
git grep -iE 'nvapi-|GOCSPX|cfat_|sk-ant' -- ':!*.md' # limpio, ningún secreto en el repo
```

Verificar: CORS del entorno demo solo acepta los orígenes `-demo.pages.dev` + localhost (Task B1 Step 10), `DEMO_DEV_AUTH_TOKEN` distinto de producción (confirmado en el scratchpad), endpoints públicos del demo son solo `/health`, `/ready`, `/bootstrap` (ya cerrado tras Task B1 Step 8), `/offers` (token firmado). Documentar los resultados en `DEMO_RESULTS.md`.

- [ ] **Step 4: Actualizar `docs/RELEASE_CANDIDATE.md`**

Agregar una sección nueva "Entorno demo (post-cierre)" que enlace a `docs/DEMO_RUNBOOK.md` y `docs/DEMO_RESULTS.md`, aclarando que los casos ELG/CMP/SEC-01 que en producción seguían NO APLICA ahora tienen cobertura real (en demo, con datos ficticios) — sin cambiar el estado de producción, que sigue siendo el registrado en Task 7.

- [ ] **Step 5: Actualizar `docs/DECISIONES_PENDIENTES.md`**

Agregar entrada: "Bolsa de temporales con `diasAcumulados` (mencionada en el diseño original / HTML de referencia `dmtr5.html`) nunca se implementó — 0 tablas, 0 código. Queda fuera de este plan y del sistema actual. Si se requiere, es una feature nueva: tabla `temporary_pool_members(employee_id, accumulated_days)` + lógica de selección por menor acumulado + integración con la cascada de Nivel 1."

- [ ] **Step 6: Gates finales**

```bash
pnpm typecheck && pnpm test && pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add docs/DEMO_RESULTS.md docs/RELEASE_CANDIDATE.md docs/DECISIONES_PENDIENTES.md
git commit -m "$(cat <<'EOF'
docs: ejecutar matriz pendiente contra el entorno demo (ELG, CMP, SEC-01, cascada, workflow, intake)

Los casos que en producción quedaron NO APLICA por falta de datos
(ELG-01..03, CMP-02..11, SEC-01) o NO EJECUTADO (LVL-02, CAS-03,
WF-01..03, DOC-01..03, ID-01) ahora tienen evidencia real contra el
entorno demo con datos ficticios diseñados a propósito para disparar
cada fallo. Producción no se tocó — su estado sigue siendo el de
docs/RELEASE_CANDIDATE.md Tarea 7. Se documenta explícitamente que la
bolsa de temporales con días acumulados nunca se implementó (queda
fuera de este plan).

Confidence: high
Scope-risk: narrow — solo documentación + datos en el D1 demo
EOF
)"
```

- [ ] **Step 8: Push y PR**

```bash
git push -u origin build/demo-calendario-v1
gh pr create --base build/connections-v1 --head build/demo-calendario-v1 \
  --title "Calendario propio + demo profesional en Cloudflare (entorno -demo)" \
  --body "$(cat <<'EOF'
## Resumen
- Pilar A: calendario configurable por grupo (semana laboral, feriados, turnos) con CRUD, UI y un bug real corregido (guarda SHIFT_CALENDAR_REQUIRED nunca disparaba).
- Pilar B: entorno Cloudflare -demo completo y separado de producción, con 10 empleados ficticios, requisitos con fallos deliberados, guión de demo en 5 actos ensayado contra las URLs reales, y ejecución de los ~20 casos del TEST_MATRIX que quedaron pendientes en producción.

Base: build/connections-v1 (PR #7 hacia main sigue abierto, sin mergear).

## Test plan
- [x] typecheck/test/build en verde tras cada tarea.
- [x] Guión completo (docs/DEMO_RUNBOOK.md) ensayado una vez de punta a punta contra el entorno demo real: correo real recibido, countdown de 2 min, expiración→cascada en vivo verificados.
- [x] docs/DEMO_RESULTS.md con evidencia por caso de la matriz pendiente.
- [x] Cero escrituras al D1 de producción (verificable: todos los comandos usan --env demo o el D1 yrak-suterm-demo).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Sin merge — esperar aprobación del usuario.

---

## Self-Review (hecho)

- **Cobertura del pedido:** calendario propio ✔ (A1-A3), demo profesional Cloudflare con BD ficticia/pruebas/fallos ✔ (B1-B4), timer 2min ✔ (B2 política), datos ficticios tipo hoja de cálculo vía JSON/import ✔ (B2), nada de integración viva con Google Sheets (decisión explícita documentada).
- **Sin placeholders de diseño:** el único placeholder literal (`REPLACE_WITH_DEMO_D1_ID`) es un valor generado en tiempo de ejecución por `wrangler d1 create`, mismo patrón que el repo ya usa en `docs/CONNECTIONS.md` — no es un TODO sin resolver.
- **Consistencia de tipos/nombres:** `loadCalendarSettings`/`CalendarSettingsConfig` se define una vez en Task A1 y se usa igual en A2 (ruta) y (indirectamente) A3 (UI vía la ruta). IDs de catálogo demo (`demo-grupo-*`, `demo-*-n5..n8`, `demo-emp-01..10`, `demo-req-*`) son consistentes entre `catalog.json`, `employees.json`, `requirements.json` y `seed-demo.sh`.
- **Producción protegida:** todo comando de Cloudflare en Pilar B lleva `--env demo` o apunta a recursos con sufijo `-demo`; el CORS solo agrega orígenes nuevos, no quita los existentes.
