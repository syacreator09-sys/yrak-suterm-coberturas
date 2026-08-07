# Despliegue manual

No se requiere GitHub Actions.

## 1. API Worker

Crear previamente D1, R2, Queue, Email binding, Workers AI, Durable Object y Workflow. Reemplazar IDs en `apps/api-worker/wrangler.jsonc`.

Secrets recomendados:

```bash
cd apps/api-worker
pnpm exec wrangler secret put BOOTSTRAP_TOKEN
pnpm exec wrangler secret put OPENAI_API_KEY      # sólo si aplica
pnpm exec wrangler secret put ANTHROPIC_API_KEY   # sólo si aplica
```

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
