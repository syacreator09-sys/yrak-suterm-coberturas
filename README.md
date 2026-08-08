# YRAK SUTERM Coberturas

Plataforma auditable para gestionar coberturas temporales, rotaciones y concursos por nivel para el proyecto YRAK/SUTERM.

## Estado del repositorio

- **Rama autoritativa:** `main`.
- La construcción limpia fue integrada desde `build/clean-v1` mediante el PR #2.
- `build/clean-v1` se conserva temporalmente como snapshot de esa integración.
- `build/end-to-end-v1` es histórico experimental y no debe fusionarse.
- `archive/main-before-clean-v1` conserva el estado de `main` anterior a la consolidación.
- El Control Center v1 se desarrolla de forma aislada en `feature/control-center-v1`; no debe fusionarse hasta observar typecheck, tests, build y pruebas por rol.
- El código, migraciones, pruebas y scripts existen; **la ejecución completa de instalación, typecheck, tests, E2E, migraciones reales y despliegue sigue siendo requisito antes de producción**.

Empieza por:

1. `docs/START_HERE.md`
2. `docs/FINAL_HANDOFF.md`
3. `docs/CONTROL_CENTER.md`
4. `docs/HANDOFF_CHECKLIST.md`
5. `docs/TEST_MATRIX.md`
6. `docs/DECISIONES_PENDIENTES.md`

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
- `apps/admin-web` — YRAK Control Center para operación, auditoría, RAG/IA e infraestructura; consume API y no reimplementa reglas laborales.
- `apps/employee-portal` — portal del trabajador.
- `apps/agent-worker` — agentes IA sin autoridad laboral.
- `apps/mcp-worker` — integración read-only con ChatGPT/Claude.
- `apps/maintenance-worker` — reconciliación y tareas programadas.
- `packages/*` — motores deterministas y componentes compartidos.
- `migrations/` — esquema e invariantes D1.
- `openapi/yrak-api.yaml` — contrato principal de integración.
- `openapi/yrak-control-center-v1.yaml` — contrato suplementario de endpoints nuevos del Control Center mientras la rama está aislada.
- `scripts/` — migración, verificación, E2E, backup, restore y despliegue manual.

## Arquitectura

Monorepo TypeScript para Cloudflare Workers, D1, Durable Objects, Workflows, R2, Queues y MCP. El dominio y los motores de decisión permanecen desacoplados de Cloudflare, del Dashboard y de cualquier proveedor de IA.

## Verificación local obligatoria antes de merge/producción

```bash
pnpm install
pnpm --filter @yrak/admin-web typecheck
pnpm --filter @yrak/admin-web test
pnpm --filter @yrak/admin-web build
pnpm --filter @yrak/api-worker typecheck
pnpm --filter @yrak/api-worker test
pnpm --filter @yrak/api-worker build
pnpm typecheck
pnpm test
pnpm build
bash scripts/migrate-local.sh
bash scripts/verify-local.sh
```

Las conexiones reales de Cloudflare, correo, RAG, IA y datos CFE/SUTERM se realizan después de estas verificaciones. El repositorio no debe contener secretos.
