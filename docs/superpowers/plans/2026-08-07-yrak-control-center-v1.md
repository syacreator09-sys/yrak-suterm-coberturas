# YRAK Control Center v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `apps/admin-web` en un Control Center modular, seguro y observable que conserve las operaciones existentes y añada vistas de RAG/IA/infraestructura sin duplicar lógica laboral en el frontend.

**Architecture:** Mantener Vite + TypeScript vanilla. El frontend se divide en shell, router, sesión/RBAC, componentes y páginas. Las decisiones laborales siguen exclusivamente en `apps/api-worker` y los paquetes de dominio. Las vistas RAG/IA/infraestructura son read-only por defecto y sólo exponen acciones sintéticas de diagnóstico en entornos autorizados.

**Tech Stack:** TypeScript 5.8.3, Vite 7, Vitest 3, Fetch API, Hono/Cloudflare Workers en backend existente.

## Global Constraints

- No introducir React/Next.js en v1.
- No guardar API keys/tokens en frontend, localStorage ni Git.
- `EMPLOYEE` se redirige al `employee-portal` cuando la autenticación real esté conectada.
- La UI puede ocultar acciones por rol, pero la autorización real permanece en API.
- IA no selecciona candidatos, no cambia calificaciones, no aprueba resultados ni mueve rotaciones.
- Acciones críticas exigen confirmación explícita y doble envío bloqueado.
- Cada vista maneja `loading`, `empty`, `error`, `ready`.
- No inventar estados de integraciones: si no pueden verificarse, mostrar `not_configured` o `unknown`.
- No declarar producción lista hasta ejecutar instalación, typecheck, tests, build y E2E reales.

---

### Task 1: Foundation, API client and session/RBAC

**Files:**
- Create: `apps/admin-web/src/core/types.ts`
- Create: `apps/admin-web/src/core/api-client.ts`
- Create: `apps/admin-web/src/core/session.ts`
- Create: `apps/admin-web/src/core/router.ts`
- Create: `apps/admin-web/src/core/permissions.ts`
- Test: `apps/admin-web/src/core/permissions.test.ts`

**Interfaces:**
- Produces `AppRole`, `SessionUser`, `AppSession`, `ApiError`, `api.get/post/put/patch/delete`, `routeForHash()`, `canAccessSection()`.

- [ ] Write failing permission tests for ADMIN, HR, SUPERVISOR, COMMITTEE, OPERATOR, AUDITOR, EMPLOYEE.
- [ ] Run `pnpm --filter @yrak/admin-web test` and verify RED.
- [ ] Implement types/API/session/router/permissions.
- [ ] Ensure API errors preserve HTTP status, error code and `x-correlation-id` when present.
- [ ] Run tests and verify GREEN.
- [ ] Commit `feat(admin): add control center core and role guards`.

### Task 2: App shell and design system

**Files:**
- Create: `apps/admin-web/src/layout/app-shell.ts`
- Create: `apps/admin-web/src/components/ui.ts`
- Create: `apps/admin-web/src/components/status.ts`
- Create: `apps/admin-web/src/styles/tokens.css`
- Create: `apps/admin-web/src/styles/layout.css`
- Create: `apps/admin-web/src/styles/components.css`
- Modify: `apps/admin-web/src/styles.css`

**Interfaces:**
- Produces `mountShell()`, `setPageTitle()`, `setGlobalStatus()`, `renderTable()`, `renderBadge()`, `renderAlert()`, `confirmCriticalAction()`.

- [ ] Implement semantic tokens, responsive shell, sidebar, topbar, mobile drawer.
- [ ] Add visible environment badge and authenticated role badge.
- [ ] Add HTML escaping to every helper that renders dynamic text.
- [ ] Add critical confirmation dialog helper and loading/disabled state helper.
- [ ] Verify no secrets or arbitrary HTML are rendered unsanitized.
- [ ] Commit `feat(admin): add control center shell and design system`.

### Task 3: Overview dashboard

**Files:**
- Create: `apps/admin-web/src/pages/overview.ts`
- Create: `apps/admin-web/src/pages/overview-model.ts`
- Test: `apps/admin-web/src/pages/overview-model.test.ts`

**Interfaces:**
- Consumes existing endpoints `/v1/employees`, `/v1/coverage-cases`, `/v1/config/groups` when permitted.
- Produces `renderOverview(ctx)`.

- [ ] Test KPI aggregation from synthetic payloads.
- [ ] Build KPI cards: personal, grupos, coberturas, activas/programadas, concursos inferred from coverage process/status when direct endpoint is unavailable.
- [ ] Render latest coverages and system connection summary.
- [ ] Degrade gracefully when one endpoint is forbidden or unavailable.
- [ ] Commit `feat(admin): add resilient overview dashboard`.

### Task 4: Operational pages migration

**Files:**
- Create: `apps/admin-web/src/pages/employees.ts`
- Create: `apps/admin-web/src/pages/coverages.ts`
- Create: `apps/admin-web/src/pages/rotations.ts`
- Create: `apps/admin-web/src/pages/competitions.ts`
- Create: `apps/admin-web/src/pages/requirements.ts`

**Interfaces:**
- Reuse existing API contracts from current `main.ts` and API routes.
- Produces one `renderX(ctx)` function per page.

- [ ] Move employee create/requirement/unavailability flows without changing payloads.
- [ ] Move coverage preview/create/detail/select/approve/complete/cancel with critical confirmations and idempotency key on create.
- [ ] Add dedicated rotation queue viewer using `/v1/config/groups/:groupId/rotation-pools` and `/v1/config/rotation-pools/:poolId/queue` for ADMIN/HR; other roles show scoped information only if API permits.
- [ ] Move competition evaluate/config/score/revision/rank/award flows, preserving second-review semantics.
- [ ] Prevent duplicate submits while requests are in flight.
- [ ] Commit `refactor(admin): modularize operational workflows`.

### Task 5: Documents and intake

**Files:**
- Create: `apps/admin-web/src/pages/documents.ts`
- Create: `apps/admin-web/src/pages/intake.ts`

**Interfaces:**
- Reuse `/v1/attachments`, `/v1/intake/*`.

- [ ] Build upload panel with file metadata preview.
- [ ] Build text extraction panel.
- [ ] Build drafts table and consume-reviewed-draft flow.
- [ ] Clearly label AI output as draft requiring human review.
- [ ] Never render file contents as HTML.
- [ ] Commit `feat(admin): add safe documents and intake workspace`.

### Task 6: RAG, AI and integrations observability surfaces

**Files:**
- Create: `apps/admin-web/src/pages/rag.ts`
- Create: `apps/admin-web/src/pages/ai.ts`
- Create: `apps/admin-web/src/pages/infrastructure.ts`
- Create: `apps/admin-web/src/config/integrations.ts`

**Interfaces:**
- Uses non-secret frontend metadata only.
- Does not require new backend endpoints to render safely.

- [ ] Render integration cards for Cloudflare, Supabase, Upstash, Modal, NVIDIA, Hugging Face, Ollama, Gmail.
- [ ] State defaults to `not_configured` unless environment metadata or health endpoint proves otherwise.
- [ ] Render AI providers/models as configured/not configured without exposing keys.
- [ ] Render RAG architecture/status placeholder as `not_configured` until Supabase/pgvector pipeline exists.
- [ ] Add disabled smoke-test controls with explanatory message until backend test endpoint exists; do not fake success.
- [ ] Commit `feat(admin): add rag ai and infrastructure control surfaces`.

### Task 7: Configuration, audit and reports

**Files:**
- Create: `apps/admin-web/src/pages/settings.ts`
- Create: `apps/admin-web/src/pages/audit.ts`
- Create: `apps/admin-web/src/pages/reports.ts`

**Interfaces:**
- Reuse `/v1/config/*`, `/v1/audit/*`, `/v1/reports/*` supported by API.

- [ ] Migrate group/level/requirement/user/rotation-pool configuration forms using exact backend schemas.
- [ ] Audit is read-only.
- [ ] Reports allow view/export only through existing endpoints.
- [ ] Hide settings from roles not allowed by `canAccessSection`, while API remains authority.
- [ ] Commit `refactor(admin): modularize settings audit and reports`.

### Task 8: Main composition and legacy removal

**Files:**
- Create: `apps/admin-web/src/app.ts`
- Replace: `apps/admin-web/src/main.ts`
- Modify: `apps/admin-web/src/api.ts`
- Modify: `apps/admin-web/src/components.ts`

**Interfaces:**
- `main.ts` only bootstraps `startApp()`.
- `app.ts` resolves session, shell, route and page renderer.

- [ ] Wire route definitions to role filters.
- [ ] Add `/v1/me` session resolution.
- [ ] Keep development email header support only when `VITE_DEV_USER_EMAIL` is explicitly set.
- [ ] Remove duplicated legacy rendering from `main.ts`.
- [ ] Ensure unknown routes redirect to overview.
- [ ] Commit `refactor(admin): compose modular control center`.

### Task 9: Security hardening and frontend tests

**Files:**
- Create: `apps/admin-web/src/core/security.ts`
- Create: `apps/admin-web/src/core/security.test.ts`
- Create: `apps/admin-web/src/core/router.test.ts`
- Modify: `apps/admin-web/index.html`

**Interfaces:**
- Produces `escapeText`, `safeExternalUrl`, `isProductionLike`, `canRunSyntheticDiagnostic`.

- [ ] Test escaping of `<script>`, quotes and object values.
- [ ] Reject non-https external dashboard URLs except localhost in development.
- [ ] Ensure diagnostics are disabled in production by default.
- [ ] Add basic CSP meta suitable for static Vite shell without inline scripts.
- [ ] Ensure no token/key values are read from URL query params or persisted in storage.
- [ ] Commit `security(admin): harden control center browser surface`.

### Task 10: Verification and handoff

**Files:**
- Modify: `docs/FINAL_HANDOFF.md`
- Create: `docs/CONTROL_CENTER.md`

- [ ] Run `pnpm install`.
- [ ] Run `pnpm --filter @yrak/admin-web typecheck`.
- [ ] Run `pnpm --filter @yrak/admin-web test`.
- [ ] Run `pnpm --filter @yrak/admin-web build`.
- [ ] Run root `pnpm typecheck`, `pnpm test`, `pnpm build`.
- [ ] Record actual results; never mark commands passed unless observed.
- [ ] Test with synthetic users for ADMIN, HR, SUPERVISOR, COMMITTEE, OPERATOR, AUDITOR and EMPLOYEE.
- [ ] Verify no browser source contains secrets.
- [ ] Create PR `feature/control-center-v1 -> main` with verification evidence and known pending external connections.
