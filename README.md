# YRAK SUTERM Coberturas

Plataforma auditable para gestionar coberturas temporales, rotaciones y concursos por nivel para el proyecto YRAK/SUTERM.

## Estado del repositorio

- **Rama autoritativa:** `main`. Rama de trabajo activa: `build/connections-v1` (varios commits adelante de `main`, pendiente de PR — ver `docs/RELEASE_CANDIDATE.md`).
- La construcción limpia fue integrada desde `build/clean-v1` mediante el PR #2.
- `build/end-to-end-v1` es histórico experimental y no debe fusionarse.
- `archive/main-before-clean-v1` conserva el estado de `main` anterior a la consolidación.
- **Estado real (2026-08-09):** la plataforma está desplegada en Cloudflare real y en operación piloto — API, panel administrativo, portal del trabajador, agentes IA, asistente y envío de correo (Gmail API) funcionando contra datos reales sembrados de un grupo piloto. `docs/TEST_MATRIX.md` fue ejecutado contra esa producción real; ver el resultado completo, los pendientes bloqueados y los hallazgos de la auditoría en `docs/RELEASE_CANDIDATE.md`. **No está lista para tráfico de empleados reales** hasta resolver los 4 pendientes bloqueados (dominio propio, `ANTHROPIC_API_KEY`, datos reales de personal, rotación del token de Cloudflare) — ver esa misma sección.

Empieza por:

1. `docs/START_HERE.md`
2. `docs/RELEASE_CANDIDATE.md` — estado real, resultado de pruebas, pendientes bloqueados.
3. `docs/RUNBOOK_AAH.md` — operación día a día del entorno ya desplegado.
4. `docs/FINAL_HANDOFF.md`
5. `docs/HANDOFF_CHECKLIST.md`
6. `docs/TEST_MATRIX.md`
7. `docs/DECISIONES_PENDIENTES.md`

## Reglas centrales

- **1 a 5 días inclusive:** rotación, sin concurso y sin requisito académico de concurso.
- **6 días o más:** elegibilidad por requisitos + examen de concurso.
- Una asignación temporal **nunca modifica el nivel base** del trabajador.
- Una cobertura sólo puede usar transiciones autorizadas, por ejemplo `nivel 7 -> nivel 8`.
- Al terminar la cobertura, la persona regresa a su nivel base.
- La IA puede extraer, explicar y redactar; **no selecciona candidatos, no cambia calificaciones y no aprueba resultados**.
- Toda operación crítica es trazable, idempotente y auditable.

## Componentes

- `apps/api-worker` — API y flujos operativos.
- `apps/admin-web` — consola administrativa.
- `apps/employee-portal` — portal del trabajador.
- `apps/agent-worker` — agentes IA sin autoridad laboral.
- `apps/mcp-worker` — integración read-only con ChatGPT/Claude.
- `apps/maintenance-worker` — reconciliación y tareas programadas.
- `packages/*` — motores deterministas y componentes compartidos.
- `migrations/` — esquema e invariantes D1.
- `openapi/yrak-api.yaml` — contrato de integración.
- `scripts/` — migración, verificación, E2E, backup, restore y despliegue manual.

## Arquitectura

Monorepo TypeScript para Cloudflare Workers, D1, Durable Objects, Workflows, R2, Queues y MCP. El dominio y los motores de decisión permanecen desacoplados de Cloudflare y de cualquier proveedor de IA.

## Verificación local posterior

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
bash scripts/migrate-local.sh
bash scripts/verify-local.sh
```

Las conexiones reales de Cloudflare, correo (Gmail API) e IA (NVIDIA NIM) ya están hechas y verificadas contra producción real (ver `docs/CONNECTIONS.md`). Los datos reales de personal CFE/SUTERM (más allá del grupo piloto) siguen pendientes. El repositorio no debe contener secretos — verificado en la auditoría de la Tarea 7 (`git grep` de patrones de secretos, limpio).
