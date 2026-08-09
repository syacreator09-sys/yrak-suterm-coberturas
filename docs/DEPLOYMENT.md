# Despliegue manual

No se requiere GitHub Actions.

## Estado real al cierre de la Tarea 7 (2026-08-09)

Los 6 componentes de abajo ya están desplegados y respondiendo en producción real:

| Componente | URL |
|---|---|
| API Worker | `https://yrak-suterm-coberturas-api.yrak-suterm.workers.dev` |
| Agent Worker | `https://yrak-suterm-agents.yrak-suterm.workers.dev` |
| Maintenance Worker | `https://yrak-suterm-maintenance.yrak-suterm.workers.dev` |
| MCP Worker | `https://yrak-suterm-mcp.yrak-suterm.workers.dev` |
| Admin Web | `https://yrak-admin-web.pages.dev` |
| Employee Portal | `https://yrak-employee-portal.pages.dev` |

Recursos reales: D1 `yrak-suterm-coberturas` (id `bf353405-5422-4b9d-a11d-c8a8a813a4b6`), R2 `yrak-suterm-evidence`, Queue `yrak-notifications`, organización `suterm-cfe`. Detalle completo de qué está conectado y qué falta en `docs/CONNECTIONS.md`; runbook de operación día a día en `docs/RUNBOOK_AAH.md`.

Para volver a desplegar cualquier componente tras un cambio de código, los pasos de abajo siguen siendo los correctos — ya se ejecutaron una vez para llegar al estado de la tabla anterior.

## 1. API Worker

Crear previamente D1, R2, Queue, Email binding, Workers AI, Durable Object y Workflow. Reemplazar IDs en `apps/api-worker/wrangler.jsonc`.

Secrets recomendados:

```bash
cd apps/api-worker
pnpm exec wrangler secret put BOOTSTRAP_TOKEN
pnpm exec wrangler secret put OPENAI_API_KEY      # sólo si aplica
pnpm exec wrangler secret put ANTHROPIC_API_KEY   # sólo si aplica
```

Secrets reales cargados hoy en producción (verificado con `wrangler secret list` en la Tarea 7, sólo nombres, nunca valores): `AI_COMPAT_API_KEY`, `BOOTSTRAP_TOKEN`, `DEV_AUTH_TOKEN`, `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER` en `api-worker`; `AGENT_API_TOKEN` y `AI_COMPAT_API_KEY` en `agent-worker`; `MCP_API_TOKEN` en `mcp-worker`. `ANTHROPIC_API_KEY` **no** está cargado todavía (pendiente bloqueado, ver `docs/RELEASE_CANDIDATE.md`). `DEV_AUTH_TOKEN` es el bypass de autenticación mientras no hay Cloudflare Access — ver `docs/RUNBOOK_AAH.md` sección 1.

Después:

```bash
bash scripts/migrate-remote.sh
bash scripts/deploy-api.sh
```

## 2. Agentes

Reemplazar D1 y organización en `apps/agent-worker/wrangler.jsonc`.

```bash
cd apps/agent-worker
pnpm exec wrangler secret put AGENT_API_TOKEN
cd ../..
bash scripts/deploy-agents.sh
```

## 3. MCP

Reemplazar D1/organización en `apps/mcp-worker/wrangler.jsonc`.

```bash
cd apps/mcp-worker
pnpm exec wrangler secret put MCP_API_TOKEN
cd ../..
bash scripts/deploy-mcp.sh
```

## 4. Panel administrativo

Configurar `VITE_API_BASE_URL` al API protegido por Cloudflare Access. En producción no configurar `VITE_DEV_USER_EMAIL`.

```bash
bash scripts/deploy-admin.sh
```

## 5. Portal del trabajador

Misma API, protegido con Access.

```bash
bash scripts/deploy-portal.sh
```

## 6. Orden recomendado

D1 → migraciones → API staging → bootstrap → datos demo → pruebas → R2/email/AI → agentes/MCP → panel/portal → datos reales → backup/restore → producción.

No desplegar producción directamente desde una base vacía sin completar `TEST_MATRIX.md`.
