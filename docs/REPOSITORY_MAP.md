# Mapa del repositorio

## Aplicaciones

### `apps/api-worker`
API autoritativa del dominio. Contiene autenticación/autorización, endpoints, Durable Object de coordinación, Workflow de cobertura, correo, Queue, intake e integraciones Cloudflare.

### `apps/admin-web`
Consola operativa para HR/Admin/Supervisor/Comité/Operador/Auditor. `public/advanced.html` contiene tareas de configuración poco frecuentes.

### `apps/employee-portal`
Portal de trabajador: nivel base, requisitos, propuestas cortas, participación en concursos, asignaciones e inconformidades.

### `apps/mcp-worker`
MCP remoto de **sólo lectura** para ChatGPT/Claude u otros clientes compatibles.

### `apps/agent-worker`
Agentes stateful sobre Durable Objects: intake, auditoría, comunicación y soporte. No tiene autoridad de negocio.

## Paquetes

- `packages/domain`: entidades, estados y reglas invariantes.
- `packages/calendar`: conteo natural/laboral/turnos.
- `packages/rotation`: selección determinista y movimiento de fila.
- `packages/eligibility`: cumplimiento de requisitos.
- `packages/competition`: ranking y desempate.
- `packages/assignments`: transiciones/autorización de niveles y traslapes.
- `packages/database`: acceso tipado a D1.
- `packages/audit`: writer append-only.
- `packages/notifications`: plantillas/outbox.
- `packages/storage`: evidencias/hash/R2.
- `packages/ai-provider`: Workers AI/OpenAI/Anthropic intercambiables.
- `packages/agents`: agentes de extracción/redacción/explicación sin decisión.
- `packages/application`: servicios puros de aplicación/preview.
- `packages/acceptance-tests`: pruebas de reglas confirmadas.

## Persistencia

- `migrations/`: esquema D1 incremental y controles de integridad.
- R2: binarios/evidencias.
- Durable Object `GroupCoordinator`: reservas concurrentes por grupo.
- Durable Object `YrakAgentSession`: memoria de agentes, separada del dominio.

## Operación

- `scripts/`: verificación, migración, smoke, E2E, deploy, backup/restore.
- `examples/`: archivos de ejemplo para carga inicial.
- `openapi/`: contrato de la API.
- `docs/`: reglas, arquitectura, seguridad, conexiones, operación y handoff.

## Fuente de verdad

La autoridad para decidir una cobertura está en:

1. D1 + configuración versionada;
2. motores deterministas de `packages/*`;
3. API Worker;
4. aprobación humana donde corresponde.

Prompts, agentes, MCP, panel y portal son interfaces; ninguno sustituye esa fuente de verdad.
