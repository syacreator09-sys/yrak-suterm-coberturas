# YRAK SUTERM Coberturas

Plataforma auditable para gestionar coberturas temporales, rotaciones y concursos por nivel para el proyecto YRAK/SUTERM.

## Estado del repositorio

- **Rama autoritativa estable:** `main`.
- **Rama para clonar, auditar y conectar en pruebas:** `ready/clone-test-connect-v1`.
- `ready/clone-test-connect-v1` NO es producción: debe pasar gates locales y staging antes de cualquier merge/promoción.
- El Control Center premium, API, Agent Worker, MCP read-only, Maintenance, portal, motores deterministas, AI router y núcleo RAG provider-agnostic conviven en el mismo monorepo.
- Las conexiones externas reales (Cloudflare, Supabase, Modal, Upstash, NVIDIA/Hugging Face/Ollama y Gmail) se validan en staging con sus cuentas/credenciales; una variable presente no equivale a una integración saludable.
- No guardar secretos en Git, issues, PRs, documentación ni prompts.

### Empieza aquí para un clon nuevo

1. `docs/CLONE_TEST_CONNECT.md`
2. `AGENTS.md`
3. `CLAUDE.md`
4. `docs/REGLAS_NEGOCIO.md`
5. `docs/DECISIONES_PENDIENTES.md`
6. `docs/CONTROL_CENTER.md`
7. `docs/TEST_MATRIX.md`

Ruta corta:

```bash
git switch ready/clone-test-connect-v1
bash scripts/bootstrap-local.sh
pnpm verify:rc
bash scripts/migrate-local.sh
pnpm dev:api
# en otra terminal, después de arrancar API:
node scripts/seed-local.mjs
```

Continúa exactamente con `docs/CLONE_TEST_CONNECT.md` para Agents, MCP, Dashboard y conexiones externas.

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
- `apps/mcp-worker` — MCP estrictamente read-only con logging de acceso.
- `apps/maintenance-worker` — reconciliación y tareas programadas.
- `packages/rag` — frontera segura/provider-agnostic de retrieval, reranking, embeddings y citas; adapters externos pendientes de conexión real.
- `packages/ai-provider` — router/proveedores IA desacoplados del dominio.
- `packages/*` — motores deterministas y componentes compartidos.
- `migrations/` — esquema e invariantes D1.
- `.claude/skills/` — skills del proyecto para dominio, verificación, Cloudflare, MCP, AI y RAG.
- `.claude/agents/` — subagentes de auditoría, pruebas, revisión e integración staging.
- `.mcp.json` — configuración MCP project-scope con expansión de variables; no contiene secreto real.
- `scripts/` — doctor, bootstrap, migración, smoke, auditoría, E2E, backup, restore y despliegue manual.

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

No se considera production-ready hasta observar además las pruebas por rol/scope, E2E de rotación y concurso, Cloudflare Access, agentes/MCP, providers, RAG, backup/restore y browser QA en staging.
