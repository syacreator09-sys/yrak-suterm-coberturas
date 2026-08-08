# YRAK — Handoff de Clone/Test/Connect v2

Branch a clonar:

```text
ready/clone-test-connect-v2
```

`main` no se usa para estas pruebas hasta que v2 tenga evidencia fresca de todos los gates aplicables.

## Secuencia mínima obligatoria

```bash
git switch ready/clone-test-connect-v2
bash scripts/bootstrap-local.sh
bash scripts/verify-clone-v2.sh
bash scripts/migrate-local.sh
pnpm dev:api
```

En otra terminal:

```bash
pnpm seed:local
CONFIRM_LOCAL_AUTH_FIXTURE=YES pnpm seed:auth-fixture
pnpm smoke:roles
```

Después arranca, cada uno en su terminal:

```bash
pnpm dev:agents
pnpm dev:mcp
pnpm dev:maintenance
pnpm dev:admin
```

Con API/Agents/MCP activos:

```bash
DEV_USER_EMAIL=admin@example.com pnpm smoke:local
AGENT_API_TOKEN=local-agent-change-me pnpm smoke:agent
```

## Lo que debe probarse antes de staging

1. Gate estático/compile/test/build completo.
2. Migraciones D1 frescas, incluyendo `0019`, `0020` y `0021`.
3. Seed local e identidades sintéticas.
4. Matriz de siete roles + aislamiento A/B.
5. PII minimizada para roles operativos scoped.
6. Intake ownership + one-draft/one-coverage idempotency.
7. Rotación 1–5 días.
8. Concurso 6+ con rules/score/ranking/human award y sin doble asignación concurrente.
9. Appeals con group scope.
10. Imports sin cross-tenant ID overwrite.
11. Attachments sólo por el flujo `INTAKE` actualmente autorizado.
12. Audit events para mutaciones críticas.
13. Notification atomic claim + stale processing recovery.
14. MCP read-only business surface.
15. Agent model/data minimization.
16. Browser desktop/mobile/CSP.
17. Backup/restore/rollback.

## RAG

El retrieval está implementado pero necesita cuenta/modelo para evidencia real:

```bash
RAG_EMBEDDING_DIMENSIONS=<dimension> pnpm render:rag-schema
```

Luego aplica el SQL generado al Supabase autorizado, configura secretos server-side y ejecuta:

```bash
DEV_USER_EMAIL=admin@example.com pnpm smoke:rag
```

Para exigir al menos un resultado sintético indexado:

```bash
REQUIRE_RAG_RESULTS=YES DEV_USER_EMAIL=admin@example.com pnpm smoke:rag
```

## Gmail

OAuth-only smoke:

```bash
GOOGLE_OAUTH_CLIENT_ID=... \
GOOGLE_OAUTH_CLIENT_SECRET=... \
GOOGLE_OAUTH_REFRESH_TOKEN=... \
pnpm smoke:gmail
```

El send smoke es explícito y self-send únicamente al mailbox de prueba.

## Cloudflare staging

No edites los Wrangler trackeados con IDs reales. Genera configs ignorados:

```bash
CONFIRM_YRAK_STAGING=YES \
YRAK_STAGING_D1_DATABASE_ID=... \
YRAK_STAGING_D1_DATABASE_NAME=... \
YRAK_STAGING_ORGANIZATION_ID=... \
YRAK_STAGING_ACCESS_TEAM_DOMAIN=<team>.cloudflareaccess.com \
YRAK_STAGING_ACCESS_AUD=... \
YRAK_STAGING_EMAIL_FROM=... \
YRAK_STAGING_R2_BUCKET=... \
YRAK_STAGING_QUEUE=... \
YRAK_STAGING_WORKFLOW=... \
pnpm render:cloudflare-staging

CONFIRM_YRAK_STAGING=YES pnpm preflight:staging
```

Sólo después procede con migraciones/deploy manuales al staging autorizado.

## Bootstrap staging

Se habilita una sola vez, únicamente si D1 staging está vacío, con las confirmaciones documentadas en `docs/CLONE_TEST_CONNECT.md`. Inmediatamente después debe deshabilitarse, ejecutar preflight otra vez y redeploy.

## No confundir estados

- **Código presente**: existe implementación en Git.
- **Gate estático pasado**: compiló/tests/build en ese checkout.
- **Configured**: hay bindings/valores requeridos.
- **Healthy**: el smoke real pasó en ese entorno.
- **Production-ready**: todos los gates y decisiones de política/seguridad/operación aplicables tienen evidencia fresca.

En esta conversación sólo se ha construido/auditado vía conector GitHub y verificaciones aisladas; el entorno actual no pudo clonar GitHub por shell, por lo que el gate completo debe ejecutarse en el equipo que clone v2.
