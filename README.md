# YRAK SUTERM Coberturas

Plataforma auditable para gestionar coberturas temporales, rotaciones y concursos por nivel para el proyecto YRAK/SUTERM.

## Estado del repositorio

- **Rama autoritativa estable:** `main`.
- **Release candidate aislada para clonar, auditar y conectar en pruebas:** `ready/clone-test-connect-v2`.
- `ready/clone-test-connect-v2` **NO es producción**: debe pasar gates locales y staging antes de cualquier merge/promoción.
- El Control Center premium, API, Agent Worker, MCP read-only, Maintenance, portal, motores deterministas, AI router y runtime RAG conviven en el mismo monorepo.
- Retrieval RAG ya tiene core, embeddings OpenAI-compatible, adapter Supabase pgvector, API y UI; ingestión/OCR/reranking/evaluaciones siguen siendo trabajo separado antes de un pipeline de conocimiento completo.
- Las conexiones externas reales se validan en staging con cuentas/credenciales autorizadas; una variable presente no equivale a una integración saludable.
- No guardar secretos en Git, issues, PRs, documentación, screenshots ni prompts.

### Empieza aquí para un clon nuevo

1. `docs/CLONE_TEST_CONNECT.md`
2. `docs/CONNECTIONS_CHECKLIST.md`
3. `docs/RELEASE_CANDIDATE_AUDIT.md`
4. `AGENTS.md`
5. `CLAUDE.md`
6. `docs/REGLAS_NEGOCIO.md`
7. `docs/DECISIONES_PENDIENTES.md`
8. `docs/TEST_MATRIX.md`

Ruta corta:

```bash
git switch ready/clone-test-connect-v2
bash scripts/bootstrap-local.sh
pnpm verify:rc
bash scripts/migrate-local.sh
pnpm dev:api
# en otra terminal, después de arrancar API:
pnpm seed:local
```

Continúa exactamente con `docs/CLONE_TEST_CONNECT.md` para Agents, MCP, Dashboard, RAG y conexiones externas.

## Reglas centrales

- **1 a 5 días inclusive:** rotación, sin concurso y sin requisito académico de concurso.
- **6 días o más:** elegibilidad por requisitos + examen de concurso + ranking determinista + aprobación humana según configuración vigente.
- Una asignación temporal **nunca modifica el nivel base** del trabajador.
- Una cobertura sólo puede usar transiciones autorizadas, por ejemplo `nivel 7 -> nivel 8`.
- Al terminar la cobertura, la persona regresa a su nivel base.
- La IA puede extraer, explicar, dar soporte y redactar; **no selecciona candidatos, no cambia calificaciones, no mueve la rotación y no aprueba resultados**.
- Toda operación crítica es trazable, idempotente cuando aplica y auditable.

## Componentes

- `apps/api-worker` — API y flujos operativos.
- `apps/admin-web` — YRAK Control Center para operación, auditoría, RAG/IA e infraestructura; consume API y no reimplementa reglas laborales.
- `apps/employee-portal` — portal del trabajador.
- `apps/agent-worker` — agentes Intake, Audit, Communication y Support sin autoridad laboral.
- `apps/mcp-worker` — MCP de negocio read-only con logging de acceso.
- `apps/maintenance-worker` — único propietario de reconciliación/tareas programadas.
- `packages/rag` — frontera segura/provider-agnostic de retrieval, embeddings, reranking y citas.
- `packages/ai-provider` — router/proveedores IA desacoplados del dominio.
- `packages/*` — motores deterministas y componentes compartidos.
- `migrations/` — esquema e invariantes D1.
- `supabase/` — schema template del sidecar pgvector RAG; D1 sigue siendo canónico para estado laboral.
- `.claude/skills/` — skills del proyecto para dominio, verificación, Cloudflare, MCP, AI y RAG.
- `.claude/agents/` — subagentes de auditoría, pruebas, revisión e integración staging.
- `.mcp.json` — configuración MCP project-scope con expansión de variables; no contiene secreto real.
- `scripts/` — doctor, bootstrap, migración, smokes, auditorías, staging preflight y utilidades de conexión.

## Arquitectura

Monorepo TypeScript para Cloudflare Workers, D1, Durable Objects, Workflows, R2, Queues y MCP. El dominio y los motores de decisión permanecen desacoplados de Cloudflare, del Dashboard y de cualquier proveedor de IA.

## Gate local antes de staging

```bash
pnpm verify:rc
bash scripts/migrate-local.sh
```

Después arranca los servicios y ejecuta:

```bash
DEV_USER_EMAIL=admin@example.com pnpm smoke:local
```

No se considera production-ready hasta observar además las pruebas por rol/scope, E2E de rotación y concurso, Cloudflare Access, agentes/MCP, providers, RAG si se habilita, notificaciones/recovery, backup/restore y browser QA en staging.
