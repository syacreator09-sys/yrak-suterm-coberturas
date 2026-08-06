# YRAK SUTERM Coberturas End-to-End Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir, probar, auditar y dejar desplegable una plataforma completa para rotaciones de 1 a 5 días, concursos de 6 días o más, asignaciones temporales por nivel, regreso automático, comunicaciones, agentes y auditoría.

**Architecture:** Monorepo TypeScript derivado selectivamente de Forja, con servicios de dominio deterministas independientes de la IA. Cloudflare Workers expone API y panel; D1 almacena el estado; Durable Objects coordinan colas concurrentes; Workflows administra procesos largos; R2 y Queues procesan evidencias; los agentes solo interpretan y comunican.

**Tech Stack:** TypeScript 5, pnpm, Turborepo, Hono, Zod, Cloudflare Workers, D1, Durable Objects, Workflows, R2, Queues, Vectorize, Vercel AI SDK, Vitest, Playwright, ESLint, Prettier, GitHub Actions.

## Global Constraints

- Coberturas de **1 a 5 días inclusive** usan rotación sin concurso.
- Coberturas de **6 días o más** requieren requisitos y examen de concurso.
- Una cobertura temporal nunca modifica `employee.baseLevelId`.
- Nivel 7 puede cubrir temporalmente nivel 8; la transición debe estar autorizada en `level_transitions`.
- Al terminar, cada asignación regresa al nivel base y se cierra con auditoría.
- La IA no selecciona candidatos, no cambia calificaciones y no aprueba asignaciones.
- Toda operación crítica debe ser idempotente, autorizada y auditable.
- Los secretos nunca se guardan en el repositorio.
- La atribución MIT de Forja debe conservarse en cualquier código derivado.
- Cada fase termina con pruebas, revisión de seguridad, documentación y commit verificable.

---

## Estrategia de ejecución

La implementación se divide en entregas verticales. Cada fase debe dejar software ejecutable y comprobable; ninguna fase se marca terminada solo porque el código compile.

Orden obligatorio:

1. Fundación y gobierno del repositorio.
2. Importación controlada del chasis Forja.
3. Dominio y base de datos.
4. Motor de coberturas cortas.
5. Asignaciones temporales y regreso.
6. Requisitos y elegibilidad.
7. Concursos y exámenes.
8. Workflows, concurrencia y tareas programadas.
9. Panel administrativo.
10. Comunicaciones y correo.
11. Audios, imágenes, documentos y agentes.
12. MCP e integraciones externas.
13. Seguridad, observabilidad y respaldo.
14. Auditoría integral, pruebas E2E y entrega.

---

### Task 1: Fundación y gobierno del repositorio

**Files:**

- Create: `README.md`
- Create: `LICENSE`
- Create: `NOTICE-FORJA.md`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `.nvmrc`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `eslint.config.js`
- Create: `.prettierrc.json`
- Create: `CLAUDE.md`
- Create: `AGENTS.md`
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Create: `.github/pull_request_template.md`
- Create: `.github/CODEOWNERS`
- Create: `.github/workflows/ci.yml`

**Interfaces:**

- Produces: comandos raíz `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build`.
- Produces: reglas permanentes para cualquier agente que modifique el repositorio.

- [ ] Crear la estructura de carpetas del monorepo.
- [ ] Fijar Node `22` en `.nvmrc` y `engines.node`.
- [ ] Configurar pnpm y Turborepo.
- [ ] Configurar TypeScript estricto con `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` y `noImplicitOverride`.
- [ ] Configurar ESLint y Prettier.
- [ ] Agregar licencia MIT y aviso de derivación de Forja.
- [ ] Escribir `CLAUDE.md` y `AGENTS.md` con las reglas de negocio confirmadas.
- [ ] Crear CI para instalación bloqueada, lint, typecheck, unitarias, integración y build.
- [ ] Ejecutar `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck` y `pnpm test`.
- [ ] Commit: `chore: establish repository foundation and governance`.

**Exit gate:** CI verde en un repositorio sin secretos y reglas del dominio visibles para humanos y agentes.

---

### Task 2: Importación controlada de Forja

**Files:**

- Create: `docs/forja-adoption.md`
- Create: `apps/worker/package.json`
- Create: `apps/worker/src/index.ts`
- Create: `apps/worker/src/env.ts`
- Create: `apps/worker/src/health.ts`
- Create: `apps/worker/wrangler.jsonc`
- Create: `packages/ai-provider/`
- Create: `packages/channel-adapters/`
- Create: `tests/contract/forja-attribution.test.ts`

**Interfaces:**

- Produces: `createApp(env: AppEnv): Hono<AppBindings>`.
- Produces: `AIProvider` y adaptadores de canal desacoplados del dominio.

```ts
export interface AIProvider {
  transcribe(input: {
    bytes: ArrayBuffer;
    mimeType: string;
  }): Promise<{ text: string; confidence?: number }>;
  extract<T>(input: { prompt: string; content: string }, schema: z.ZodType<T>): Promise<T>;
  generate(input: { system: string; prompt: string }): Promise<string>;
}
```

- [ ] Auditar los archivos de Forja antes de copiarlos.
- [ ] Copiar solo infraestructura necesaria: Hono, proveedor LLM, patrón Durable Object, R2, panel base y webhooks útiles.
- [ ] Excluir nichos, ventas, leads y herramientas no relacionadas.
- [ ] Registrar origen, archivo, SHA y cambios en `docs/forja-adoption.md`.
- [ ] Mantener aviso MIT.
- [ ] Implementar `/health` y `/ready` sin dependencia de IA.
- [ ] Crear proveedor IA falso para pruebas.
- [ ] Probar que la aplicación arranca localmente con Miniflare.
- [ ] Commit: `feat: adopt minimal Forja Cloudflare foundation`.

**Exit gate:** Worker mínimo ejecutable, atribución completa y ninguna regla laboral dentro de prompts heredados.

---

### Task 3: Dominio, tipos y máquina de estados

**Files:**

- Create: `packages/domain/src/ids.ts`
- Create: `packages/domain/src/entities.ts`
- Create: `packages/domain/src/enums.ts`
- Create: `packages/domain/src/policies/coverage-policy.ts`
- Create: `packages/domain/src/state/coverage-state-machine.ts`
- Create: `packages/domain/src/state/assignment-state-machine.ts`
- Create: `packages/domain/src/errors.ts`
- Test: `tests/unit/domain/coverage-policy.test.ts`
- Test: `tests/unit/domain/state-machines.test.ts`

**Interfaces:**

```ts
export type CoverageProcessType = 'ROTATION' | 'COMPETITION';

export interface CoveragePolicyConfig {
  shortCoverageMaximumDays: number;
  longCoverageMinimumDays: number;
  dayCountingMode: 'CALENDAR_DAYS' | 'WORKING_DAYS' | 'SHIFTS';
}

export function determineCoverageProcess(
  days: number,
  config: CoveragePolicyConfig,
): CoverageProcessType;
```

- [ ] Escribir pruebas fallidas para días 1, 5, 6, duración cero y duración negativa.
- [ ] Implementar `determineCoverageProcess`.
- [ ] Definir estados y transiciones permitidas.
- [ ] Impedir `ACTIVE -> DRAFT`, `COMPLETED -> ACTIVE` y cambios inválidos.
- [ ] Definir entidades sin dependencias de Cloudflare.
- [ ] Ejecutar unitarias y mutation testing sobre políticas críticas.
- [ ] Commit: `feat: define coverage domain and state machines`.

**Exit gate:** El dominio funciona en memoria, sin D1 ni IA, y todas las fronteras 1–5/6+ están probadas.

---

### Task 4: Esquema D1, migraciones y repositorios

**Files:**

- Create: `migrations/0001_identity.sql`
- Create: `migrations/0002_requirements.sql`
- Create: `migrations/0003_coverages.sql`
- Create: `migrations/0004_rotation.sql`
- Create: `migrations/0005_competitions.sql`
- Create: `migrations/0006_audit_and_messages.sql`
- Create: `packages/database/src/client.ts`
- Create: `packages/database/src/repositories/*.ts`
- Create: `packages/database/src/transactions.ts`
- Create: `scripts/seed-demo.ts`
- Test: `tests/integration/database/migrations.test.ts`
- Test: `tests/integration/database/repositories.test.ts`

**Interfaces:**

```ts
export interface EmployeeRepository {
  getById(id: EmployeeId): Promise<Employee | null>;
  listEligibleSourceLevel(
    groupId: GroupId,
    sourceLevelId: LevelId,
    period: DateRange,
  ): Promise<Employee[]>;
}

export interface CoverageCaseRepository {
  create(input: CreateCoverageCase): Promise<CoverageCase>;
  transition(
    id: CoverageCaseId,
    expectedVersion: number,
    next: CoverageCaseStatus,
  ): Promise<CoverageCase>;
}
```

- [ ] Crear claves primarias, foráneas, índices y constraints.
- [ ] Guardar fechas en UTC y zona operativa por organización.
- [ ] Agregar `version` para optimistic locking.
- [ ] Agregar `idempotency_keys` con restricción única.
- [ ] Agregar triggers o restricciones que impidan editar `audit_events`.
- [ ] Crear repositorios tipados.
- [ ] Crear semilla de dos grupos, niveles 5–8 y candidatos de prueba.
- [ ] Probar migración desde cero y rollback documentado.
- [ ] Commit: `feat: add D1 schema and typed repositories`.

**Exit gate:** Base recreable desde cero, semilla reproducible e integridad referencial validada.

---

### Task 5: Motor de rotación de 1 a 5 días

**Files:**

- Create: `packages/rotation/src/rotation-engine.ts`
- Create: `packages/rotation/src/rotation-policy.ts`
- Create: `packages/rotation/src/rotation-service.ts`
- Create: `packages/rotation/src/types.ts`
- Test: `tests/unit/rotation/rotation-engine.test.ts`
- Test: `tests/integration/rotation/rotation-service.test.ts`

**Interfaces:**

```ts
export interface RotationCandidate {
  employeeId: EmployeeId;
  position: number;
  availability: 'AVAILABLE' | 'UNAVAILABLE' | 'RESERVED' | 'ASSIGNED' | 'SUSPENDED';
}

export function selectNextCandidate(candidates: RotationCandidate[]): RotationCandidate;

export interface CompleteRotationInput {
  poolId: RotationPoolId;
  employeeId: EmployeeId;
  coverageCaseId: CoverageCaseId;
  consumedTurn: boolean;
}
```

- [ ] Probar selección del primer disponible.
- [ ] Probar salto de vacaciones, incapacidad, reserva y asignación activa.
- [ ] Probar ausencia total de candidatos.
- [ ] Probar movimiento al final al completar.
- [ ] Probar cancelación previa sin consumir turno.
- [ ] Probar rechazo voluntario con política configurable.
- [ ] Registrar evento antes y después de cada modificación.
- [ ] Simular dos solicitudes concurrentes y verificar que no seleccionan la misma persona.
- [ ] Commit: `feat: implement auditable short-coverage rotation`.

**Exit gate:** Una ausencia de 1 a 5 días produce selección reproducible y trazable sin consultar un LLM.

---

### Task 6: Asignaciones temporales, cadena y regreso

**Files:**

- Create: `packages/assignments/src/assignment-service.ts`
- Create: `packages/assignments/src/chain-planner.ts`
- Create: `packages/assignments/src/return-service.ts`
- Create: `packages/assignments/src/conflict-detector.ts`
- Test: `tests/unit/assignments/chain-planner.test.ts`
- Test: `tests/integration/assignments/lifecycle.test.ts`

**Interfaces:**

```ts
export interface TemporaryAssignment {
  employeeId: EmployeeId;
  baseLevelId: LevelId;
  targetLevelId: LevelId;
  startsAt: string;
  endsAt: string;
}

export function assertBaseLevelUnchanged(employee: Employee, assignment: TemporaryAssignment): void;
export function planCoverageChain(input: ChainPlanInput): CoverageChainStep[];
```

- [ ] Probar nivel 7 cubriendo nivel 8.
- [ ] Probar rechazo de transición no autorizada.
- [ ] Probar cadena 7→8, 6→7 y 5→6.
- [ ] Probar que el nivel base permanece idéntico antes, durante y después.
- [ ] Probar conflicto de fechas.
- [ ] Probar sustitución de una persona que abandona una cobertura activa.
- [ ] Cerrar la cadena en orden seguro y registrar `returnedAt`.
- [ ] Commit: `feat: implement temporary assignments and automatic return`.

**Exit gate:** El sistema demuestra que nadie queda permanentemente en el nivel temporal.

---

### Task 7: Requisitos y motor de elegibilidad

**Files:**

- Create: `packages/eligibility/src/eligibility-engine.ts`
- Create: `packages/eligibility/src/requirement-evaluator.ts`
- Create: `packages/eligibility/src/evidence-service.ts`
- Test: `tests/unit/eligibility/eligibility-engine.test.ts`
- Test: `tests/integration/eligibility/expiry.test.ts`

**Interfaces:**

```ts
export interface EligibilityResult {
  employeeId: EmployeeId;
  eligible: boolean;
  reasons: Array<{
    requirementId: RequirementId;
    code: 'MISSING' | 'EXPIRED' | 'REJECTED' | 'PENDING';
    messageKey: string;
  }>;
}

export function evaluateEligibility(input: EligibilityInput): EligibilityResult;
```

- [ ] Probar curso cumplido, faltante, vencido y pendiente.
- [ ] Probar certificación que vence antes del inicio.
- [ ] Probar regla configurable de vigencia durante todo el periodo.
- [ ] Probar evidencia rechazada.
- [ ] Mostrar todas las razones, no solo la primera.
- [ ] Prohibir que el texto generado por IA cambie `eligible`.
- [ ] Commit: `feat: implement deterministic eligibility evaluation`.

**Exit gate:** Cada candidato tiene un resultado explicable y verificable desde la base de datos.

---

### Task 8: Concursos, exámenes, ranking y desempate

**Files:**

- Create: `packages/competition/src/competition-service.ts`
- Create: `packages/competition/src/exam-service.ts`
- Create: `packages/competition/src/ranking-engine.ts`
- Create: `packages/competition/src/tie-breakers.ts`
- Create: `packages/competition/src/appeals-service.ts`
- Test: `tests/unit/competition/ranking-engine.test.ts`
- Test: `tests/integration/competition/full-competition.test.ts`

**Interfaces:**

```ts
export interface CandidateScore {
  employeeId: EmployeeId;
  examScore: number;
  seniorityDate: string;
  criticalSectionScore?: number;
}

export type TieBreakerRule =
  { type: 'CRITICAL_SECTION' } | { type: 'SENIORITY' } | { type: 'DOCUMENTED_DRAW' };

export function rankCandidates(
  scores: CandidateScore[],
  rules: TieBreakerRule[],
): RankedCandidate[];
```

- [ ] Validar calificaciones entre 0 y 100.
- [ ] Probar ranking descendente.
- [ ] Probar empate por sección crítica.
- [ ] Probar empate por antigüedad.
- [ ] Probar empate todavía no resuelto y estado `PENDING_DRAW`.
- [ ] Requerir doble aprobación para corregir una calificación publicada.
- [ ] Conservar valor anterior, nuevo, motivo y evidencia.
- [ ] Probar que un no elegible nunca aparece en el ranking.
- [ ] Commit: `feat: implement long-coverage competitions and ranking`.

**Exit gate:** Una ausencia de 6+ días puede completar convocatoria, examen, ranking, aprobación y asignación.

---

### Task 9: Durable Objects, Workflows y programación

**Files:**

- Create: `apps/worker/src/durable/group-coordinator.ts`
- Create: `apps/worker/src/workflows/short-coverage-workflow.ts`
- Create: `apps/worker/src/workflows/competition-workflow.ts`
- Create: `apps/worker/src/workflows/return-workflow.ts`
- Create: `apps/worker/src/queues/consumer.ts`
- Test: `tests/integration/workflows/*.test.ts`
- Test: `tests/integration/concurrency/group-coordinator.test.ts`

**Interfaces:**

```ts
export interface ReserveCandidateCommand {
  idempotencyKey: string;
  groupId: GroupId;
  employeeId: EmployeeId;
  startsAt: string;
  endsAt: string;
}
```

- [ ] Implementar un coordinador por grupo.
- [ ] Reservar candidato y fila dentro de una operación serializada.
- [ ] Implementar reintentos seguros.
- [ ] Esperar aprobación humana sin bloquear una petición HTTP.
- [ ] Programar cierre y regreso.
- [ ] Recalcular si la ausencia se extiende de 5 a 6 días antes de iniciar.
- [ ] Evitar dobles correos y dobles asignaciones tras reintentos.
- [ ] Probar reinicio simulado del Worker.
- [ ] Commit: `feat: coordinate durable coverage workflows`.

**Exit gate:** Los procesos sobreviven reintentos y concurrencia sin duplicar decisiones.

---

### Task 10: API, autenticación y permisos

**Files:**

- Create: `apps/worker/src/routes/*.ts`
- Create: `apps/worker/src/auth/session.ts`
- Create: `apps/worker/src/auth/rbac.ts`
- Create: `packages/shared/src/api-contracts.ts`
- Test: `tests/contract/api/*.test.ts`
- Test: `tests/integration/auth/rbac.test.ts`

**Interfaces:**

Endpoints mínimos:

```text
POST   /api/absences
GET    /api/coverage-cases/:id
POST   /api/coverage-cases/:id/calculate
POST   /api/coverage-cases/:id/approve
POST   /api/coverage-cases/:id/cancel
GET    /api/rotation-pools/:id
POST   /api/rotation-pools/:id/simulate
GET    /api/levels/:id/eligible-candidates
POST   /api/competitions
POST   /api/competitions/:id/scores
POST   /api/competitions/:id/publish
GET    /api/audit/events
```

- [ ] Definir contratos Zod para petición y respuesta.
- [ ] Implementar sesiones seguras y expiración.
- [ ] Implementar permisos por rol, organización y grupo.
- [ ] Rechazar escrituras de auditor.
- [ ] Ocultar calificaciones antes de publicación a roles no autorizados.
- [ ] Probar IDOR, elevación de privilegios y sesión vencida.
- [ ] Commit: `feat: expose secure typed coverage API`.

**Exit gate:** Ninguna función del panel puede saltarse permisos llamando directamente a la API.

---

### Task 11: Panel administrativo end-to-end

**Files:**

- Create: `apps/worker/src/admin/layout.tsx`
- Create: `apps/worker/src/admin/pages/dashboard.tsx`
- Create: `apps/worker/src/admin/pages/groups.tsx`
- Create: `apps/worker/src/admin/pages/employees.tsx`
- Create: `apps/worker/src/admin/pages/coverage-case.tsx`
- Create: `apps/worker/src/admin/pages/rotation.tsx`
- Create: `apps/worker/src/admin/pages/competition.tsx`
- Create: `apps/worker/src/admin/pages/requirements.tsx`
- Create: `apps/worker/src/admin/pages/audit.tsx`
- Test: `tests/e2e/admin/*.spec.ts`

**Views obligatorias:**

- tablero de coberturas activas y conflictos;
- mapa por grupo y niveles;
- ficha del trabajador con nivel base y temporal;
- fila rotativa actual e historial;
- simulación de cobertura corta;
- elegibilidad con razones;
- concurso, examen y ranking;
- aprobaciones;
- auditoría;
- bandeja de documentos pendientes de revisión.

- [ ] Diseñar navegación responsiva.
- [ ] Implementar estados vacíos, carga y error.
- [ ] Mostrar siempre nivel base separado del temporal.
- [ ] Agregar confirmaciones para acciones críticas.
- [ ] Agregar accesibilidad de teclado, etiquetas y contraste.
- [ ] Probar viewport móvil y escritorio.
- [ ] Probar el flujo completo con Playwright.
- [ ] Commit: `feat: build complete administrative console`.

**Exit gate:** Un operador autorizado puede completar ambos tipos de cobertura sin usar terminal ni editar base de datos.

---

### Task 12: Correo y notificaciones

**Files:**

- Create: `packages/notifications/src/templates/*.ts`
- Create: `packages/notifications/src/email-adapter.ts`
- Create: `packages/notifications/src/outbox-service.ts`
- Create: `apps/worker/src/email/inbound.ts`
- Test: `tests/unit/notifications/templates.test.ts`
- Test: `tests/integration/notifications/outbox.test.ts`

**Interfaces:**

```ts
export interface EmailAdapter {
  send(message: {
    to: string[];
    subject: string;
    html: string;
    text: string;
    idempotencyKey: string;
  }): Promise<{ providerMessageId: string }>;
}
```

- [ ] Crear plantillas para solicitud incompleta, asignación corta, convocatoria, no elegible, recordatorio, resultado, inicio, cierre y regreso.
- [ ] Usar outbox transaccional.
- [ ] Probar reintentos sin duplicados.
- [ ] Incluir folio y liga firmada al expediente.
- [ ] Sanitizar HTML.
- [ ] Implementar adaptador sandbox y adaptador real configurable.
- [ ] Commit: `feat: add reliable coverage email notifications`.

**Exit gate:** Todos los correos pueden probarse sin credenciales reales y conectarse al proveedor al final.

---

### Task 13: Audios, imágenes, documentos y agentes

**Files:**

- Create: `packages/agents/src/intake-agent.ts`
- Create: `packages/agents/src/communication-agent.ts`
- Create: `packages/agents/src/audit-assistant.ts`
- Create: `packages/agents/src/tools/*.ts`
- Create: `packages/agents/src/prompts/*.ts`
- Create: `apps/worker/src/uploads/routes.ts`
- Create: `apps/worker/src/queues/document-consumer.ts`
- Test: `tests/contract/agents/tool-boundaries.test.ts`
- Test: `tests/integration/uploads/document-intake.test.ts`

**Structured output:**

```ts
export const IntakeDraftSchema = z.object({
  groupId: z.string().nullable(),
  vacantLevelId: z.string().nullable(),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  reason: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  missingFields: z.array(z.string()),
});
```

- [ ] Validar MIME, tamaño, hash y extensión.
- [ ] Guardar original en R2 antes de procesar.
- [ ] Transcribir audio con proveedor intercambiable.
- [ ] Extraer datos con salida estructurada.
- [ ] Marcar como borrador pendiente de revisión.
- [ ] Impedir que herramientas IA llamen directamente a SQL.
- [ ] Permitir solo herramientas con contratos y RBAC.
- [ ] Probar prompt injection dentro de documentos.
- [ ] Probar datos contradictorios y confianza baja.
- [ ] Commit: `feat: add safe multimodal intake and bounded agents`.

**Exit gate:** Un audio o imagen genera un borrador revisable, nunca una asignación automática no autorizada.

---

### Task 14: MCP y conectores externos

**Files:**

- Create: `apps/mcp/package.json`
- Create: `apps/mcp/src/server.ts`
- Create: `apps/mcp/src/tools/*.ts`
- Create: `packages/channel-adapters/src/whatsapp.ts`
- Create: `packages/channel-adapters/src/meta.ts`
- Create: `docs/connections-runbook.md`
- Test: `tests/contract/mcp/tools.test.ts`

**Herramientas MCP de solo lectura iniciales:**

```text
get_coverage_case
list_active_coverages
get_rotation_queue
explain_candidate_eligibility
list_competition_results
get_audit_timeline
```

**Herramientas de escritura con confirmación explícita:**

```text
create_absence_draft
approve_coverage_case
cancel_coverage_case
record_exam_score
```

- [ ] Implementar OAuth o token de servicio con alcance mínimo.
- [ ] Separar lectura y escritura.
- [ ] Requerir confirmación para cambios críticos.
- [ ] Probar que ChatGPT o Claude no puede saltarse RBAC.
- [ ] Implementar adaptadores externos detrás de feature flags.
- [ ] Documentar cada credencial y callback necesarios.
- [ ] Commit: `feat: expose controlled MCP and channel integrations`.

**Exit gate:** El sistema funciona sin MCP y puede conectarlo después sin modificar el dominio.

---

### Task 15: Seguridad, observabilidad, respaldos y recuperación

**Files:**

- Create: `apps/worker/src/security/*.ts`
- Create: `packages/audit/src/audit-service.ts`
- Create: `packages/observability/src/logger.ts`
- Create: `scripts/backup-d1.ts`
- Create: `scripts/restore-d1.ts`
- Create: `scripts/export-audit.ts`
- Create: `docs/backup-restore-runbook.md`
- Create: `docs/incident-response.md`
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/security.yml`
- Test: `tests/security/*.test.ts`

- [ ] Agregar CSP, HSTS, cookies seguras, CSRF y rate limiting.
- [ ] Redactar secretos y datos sensibles en logs.
- [ ] Generar `correlationId` por petición y workflow.
- [ ] Implementar métricas de error, latencia, cola y conflictos.
- [ ] Agregar auditoría de dependencias y secret scanning.
- [ ] Probar restauración de respaldo en entorno temporal.
- [ ] Probar exportación de auditoría verificando hash.
- [ ] Ejecutar revisión OWASP ASVS aplicable.
- [ ] Commit: `security: harden platform and add recovery controls`.

**Exit gate:** Existe evidencia de que un respaldo puede restaurarse y que los controles críticos están probados.

---

### Task 16: Auditoría integral y pruebas end-to-end

**Files:**

- Create: `tests/e2e/scenarios/short-coverage.spec.ts`
- Create: `tests/e2e/scenarios/long-competition.spec.ts`
- Create: `tests/e2e/scenarios/cascade-return.spec.ts`
- Create: `tests/e2e/scenarios/concurrency.spec.ts`
- Create: `tests/e2e/scenarios/permissions.spec.ts`
- Create: `tests/e2e/scenarios/multimodal-intake.spec.ts`
- Create: `docs/acceptance-report.md`
- Create: `docs/traceability-matrix.md`

**Escenarios obligatorios:**

1. Ausencia de 3 días: primer candidato disponible, sin requisitos ni examen, regreso y movimiento al final.
2. Ausencia de 5 días: mismo flujo corto.
3. Ausencia de 6 días: requisitos, examen, ranking y asignación.
4. Nivel 7 cubre 8 sin alterar nivel base.
5. Cadena 7→8, 6→7, 5→6 y regreso completo.
6. Dos solicitudes concurrentes no comparten candidato.
7. Certificación vencida produce exclusión explicada.
8. Corrección de calificación requiere doble aprobación.
9. Cancelación previa no consume turno.
10. Audio ambiguo produce borrador y solicitud de revisión.
11. Auditor solo puede leer.
12. Reintento de webhook no duplica mensajes ni asignaciones.

- [ ] Ejecutar todos los escenarios contra Miniflare y staging.
- [ ] Crear matriz requisito → prueba → evidencia.
- [ ] Ejecutar auditoría de código con revisor independiente/agente separado.
- [ ] Corregir hallazgos P0 y P1; documentar P2 aceptados.
- [ ] Ejecutar pruebas de regresión completas.
- [ ] Commit: `test: certify end-to-end coverage workflows`.

**Exit gate:** Reporte firmado con 100% de requisitos críticos cubiertos y cero fallas P0/P1 abiertas.

---

### Task 17: Staging, producción y paquete de entrega

**Files:**

- Create: `wrangler.staging.jsonc`
- Create: `wrangler.production.jsonc`
- Create: `.github/workflows/deploy-staging.yml`
- Create: `.github/workflows/deploy-production.yml`
- Create: `docs/deployment-runbook.md`
- Create: `docs/owner-connections-checklist.md`
- Create: `docs/admin-user-guide.md`
- Create: `docs/operator-user-guide.md`
- Create: `docs/final-handover.md`

- [ ] Crear bindings independientes de staging y producción.
- [ ] Configurar despliegue automático a staging después de CI.
- [ ] Configurar producción con aprobación manual.
- [ ] Ejecutar smoke tests posteriores al despliegue.
- [ ] Cargar datos ficticios de demostración, nunca datos reales.
- [ ] Generar usuarios de prueba por rol.
- [ ] Verificar runbooks en una instalación limpia.
- [ ] Preparar checklist final de credenciales y conexiones.
- [ ] Etiquetar `v1.0.0-rc.1`.
- [ ] Commit: `release: prepare audited release candidate`.

**Exit gate:** Staging operativo con datos demo y producción lista para recibir exclusivamente conexiones y datos reales.

---

## Revisión obligatoria entre fases

Al terminar cada fase se ejecutarán cuatro revisiones:

1. **Revisión funcional:** cumple el criterio exacto de la fase.
2. **Revisión de código:** límites, tipos, errores, mantenibilidad y deuda.
3. **Revisión de seguridad:** permisos, datos, secretos, inyección e idempotencia.
4. **Revisión de pruebas:** casos positivos, negativos, bordes y concurrencia.

Ninguna fase avanza con una falla crítica pendiente.

## Matriz de definición de terminado

Cada tarea debe cumplir todo:

- código y documentación comprometidos;
- lint y typecheck verdes;
- pruebas unitarias e integración verdes;
- pruebas negativas incluidas;
- auditoría registrada cuando corresponda;
- sin secretos ni datos personales reales;
- revisión independiente completada;
- changelog o decisión documentada;
- rollback conocido;
- CI verde.

## Conexiones que quedarán para el propietario al final

La plataforma se construirá usando adaptadores falsos o sandbox. Para activar producción se requerirá solamente:

1. Autorizar la cuenta de Cloudflare y crear bindings reales.
2. Seleccionar dominio o conservar `workers.dev`.
3. Registrar remitente y credenciales de correo.
4. Cargar la API key del proveedor de IA mediante secreto.
5. Conectar WhatsApp/Meta si se decide usar esos canales.
6. Importar empleados, grupos, niveles y requisitos reales.
7. Confirmar días naturales, laborales o turnos.
8. Confirmar regla oficial de desempate.
9. Crear usuarios y asignar roles.
10. Aprobar el paso de staging a producción.

No será necesario modificar código para estas conexiones.

## Secuencia de auditoría final

```text
SPEC REVIEW
   ↓
ARCHITECTURE REVIEW
   ↓
DOMAIN/RULES AUDIT
   ↓
DATABASE INTEGRITY AUDIT
   ↓
SECURITY AUDIT
   ↓
ACCESSIBILITY REVIEW
   ↓
E2E REGRESSION
   ↓
BACKUP/RESTORE DRILL
   ↓
STAGING ACCEPTANCE
   ↓
OWNER CONNECTIONS
   ↓
PRODUCTION SMOKE TEST
```

## Resultado esperado al regreso del propietario

El objetivo de ejecución es dejar:

- repositorio completo y documentado;
- CI y pruebas verdes;
- staging funcional con datos demo;
- panel y flujos end-to-end;
- agentes limitados y auditados;
- adaptadores externos listos;
- runbooks de instalación, operación y recuperación;
- lista exacta de credenciales y decisiones finales;
- cero tareas de programación necesarias para conectar producción.

## Nota operativa

La construcción debe ejecutarse dentro de sesiones activas de trabajo y commits verificables. No se asumirá trabajo en segundo plano fuera de una sesión activa; cada avance deberá quedar visible en GitHub y en CI.
