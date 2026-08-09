# Runbook operativo — YRAK SUTERM Coberturas

Runbook de operación para el entorno piloto ya desplegado (rama `build/connections-v1`). Escrito al cierre de la Tarea 7 de `.superpowers/sdd/2026-08-09-yrak-e2e-final/`, ejecutada con el harness de agentes de este repo (`.aah/`). Este documento asume que ya se hizo el despliegue inicial descrito en `docs/DEPLOYMENT.md` y en `docs/FINAL_HANDOFF.md`; aquí sólo cubre operación día a día.

## 1. Referencia rápida de recursos

| Recurso | Valor |
|---|---|
| API Worker | `https://yrak-suterm-coberturas-api.yrak-suterm.workers.dev` |
| Agent Worker | `https://yrak-suterm-agents.yrak-suterm.workers.dev` |
| Maintenance Worker | `https://yrak-suterm-maintenance.yrak-suterm.workers.dev` |
| MCP Worker | `https://yrak-suterm-mcp.yrak-suterm.workers.dev` |
| Admin Web | `https://yrak-admin-web.pages.dev` |
| Employee Portal | `https://yrak-employee-portal.pages.dev` |
| D1 database | `yrak-suterm-coberturas` (id `bf353405-5422-4b9d-a11d-c8a8a813a4b6`) |
| R2 bucket | `yrak-suterm-evidence` |
| Organización | `suterm-cfe` (single-organization guard activo) |
| Cron | `* * * * *` en `api-worker` (barrido de ofertas vencidas + requisitos expirados + reintentos de notificación); `*/15 * * * *` en `maintenance-worker` |

Autenticación durante el piloto (sin dominio propio): header `Cf-Access-Authenticated-User-Email` no existe todavía; en su lugar hay un bypass de desarrollo gateado por dos valores — `x-yrak-user-email: <correo del usuario ya provisionado en la tabla `users`>` y `x-yrak-dev-token: <DEV_AUTH_TOKEN>`. Este bypass **debe desactivarse** en cuanto haya dominio y Cloudflare Access reales (ver `docs/DECISIONES_PENDIENTES.md`).

## 2. Chequeos de salud

```bash
curl -s https://yrak-suterm-coberturas-api.yrak-suterm.workers.dev/health
curl -s https://yrak-suterm-coberturas-api.yrak-suterm.workers.dev/ready
```

Ambos deben devolver `{"ok":true,...}`. `/ready` además confirma que el binding D1 y el Durable Object `GROUP_COORDINATOR` están configurados.

Ver logs en vivo de un worker:

```bash
cd apps/api-worker && pnpm exec wrangler tail
```

## 3. Consultar el estado real (D1)

Todas las consultas de sólo lectura se pueden correr directo contra producción:

```bash
cd apps/api-worker
CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<account> \
  pnpm exec wrangler d1 execute yrak-suterm-coberturas --remote \
  --command="SELECT id,status,process_type FROM coverage_cases ORDER BY created_at DESC LIMIT 20;"
```

Tablas clave para diagnóstico:

- `coverage_cases` — expediente de cada cobertura (estado, tipo de proceso, fechas).
- `temporary_assignments` — quién está propuesto/asignado, `offer_expires_at`/`offer_token_hash` para el flujo de oferta por correo.
- `rotation_queue_entries` — estado de fila por pool (`AVAILABLE`/`RESERVED`/`ASSIGNED`/`UNAVAILABLE`).
- `rotation_events` — historial de movimientos de fila (auditable, pero separado de `audit_events`).
- `audit_events` — bitácora append-only de toda acción crítica (ver sección 6, es inmutable por trigger D1).
- `notifications` — cola de correo, incluye `payload_json` con las URLs de aceptar/rechazar (útil para depurar sin tener que revisar la bandeja de entrada real).

## 4. Operaciones comunes

### 4.1 Crear una cobertura de prueba sin efectos secundarios

Usar `POST /v1/coverage-cases/preview` (sólo lectura, no escribe nada) para verificar qué `processType` resultaría de un rango de fechas antes de crear el expediente real:

```bash
curl -s -H "x-yrak-user-email: <admin>" -H "x-yrak-dev-token: <token>" -H "content-type: application/json" \
  -X POST https://yrak-suterm-coberturas-api.yrak-suterm.workers.dev/v1/coverage-cases/preview \
  -d '{"groupId":"<groupId>","startDate":"2027-01-01","endDate":"2027-01-03"}'
```

### 4.2 Forzar el vencimiento de una oferta de rotación (para probar la cascada)

El cron de `api-worker` corre cada minuto y reasigna automáticamente cualquier oferta `PROPOSED` cuyo `offer_expires_at` ya pasó. Para probarlo sin esperar el timeout real de la política del grupo:

```sql
UPDATE temporary_assignments SET offer_expires_at = datetime('now', '-1 minute')
WHERE id = '<assignmentId>' AND status = 'PROPOSED';
```

Esperar hasta 60 segundos y volver a consultar `temporary_assignments`/`rotation_events`/`notifications` para el mismo `coverage_case_id`.

### 4.3 Cambiar la política de un grupo (por ejemplo, habilitar cascada)

`POST /v1/policies/groups/:groupId/coverage` crea una **nueva versión** (no sobreescribe la anterior — el historial completo queda en `group_policies`). Enviar siempre los 5 campos aunque sólo se quiera cambiar uno, para no perder el resto de la configuración vigente:

```bash
curl -s -H "x-yrak-user-email: <admin>" -H "x-yrak-dev-token: <token>" -H "content-type: application/json" \
  -X POST https://yrak-suterm-coberturas-api.yrak-suterm.workers.dev/v1/policies/groups/<groupId>/coverage \
  -d '{"dayCountingMode":"CALENDAR_DAYS","rejectionConsumesTurn":true,"cascadeEnabled":true,"cascadeMaximumDepth":10,"rotationOfferTimeoutMinutes":1440,"effectiveFrom":"2020-01-01"}'
```

Para consultar la política vigente de un grupo: `GET /v1/policies/groups/:groupId/coverage`.

### 4.4 Cancelar un expediente de prueba

```bash
curl -s -H "x-yrak-user-email: <admin>" -H "x-yrak-dev-token: <token>" -H "content-type: application/json" \
  -X POST https://yrak-suterm-coberturas-api.yrak-suterm.workers.dev/v1/coverage-cases/<caseId>/cancel \
  -d '{"reason":"motivo obligatorio, min 3 caracteres"}'
```

Si el expediente tiene hijos por cascada, se cancelan recursivamente. Si la asignación activa está `ACTIVE` (ya en curso), la API exige el campo adicional `activeRotationConsumesTurn: true|false` — no lo adivina.

## 5. Problemas encontrados en la auditoría de la Tarea 7 — CORREGIDOS en Tarea 7b (mismo día)

Ver el detalle completo en `docs/RELEASE_CANDIDATE.md`, sección "Hallazgos de esta auditoría — CORREGIDOS". Resumen operativo (ya no reproducibles en el código actual, gates verdes y reverificado contra producción):

1. Rechazar una oferta con `rejectionConsumesTurn=true` reactivaba como `AVAILABLE` a compañeros de fila que en realidad seguían `ASSIGNED` a otra cobertura en el mismo pool. **Corregido** en `rotation-response-service.ts`: el `UPDATE` de reordenamiento ahora solo cambia `status` para el empleado que rechazó.
2. Cancelar un expediente con más de una fila en `temporary_assignments` podía liberar la fila de la cola del empleado equivocado. **Corregido** en `cancellation-service.ts`: la selección de la asignación relevante ahora filtra `status NOT IN ('CANCELLED','COMPLETED','REPLACED')`.
3. El mismo patrón del hallazgo 1 existía también en `completeRotationAssignment` (regreso a nivel base, `rotation-service.ts`) — encontrado por inspección propia al corregir el 1, no por el auditor. **Corregido** con el mismo enfoque.

Si en algún momento ves a un empleado en `rotation_queue_entries.status='AVAILABLE'` mientras tiene una asignación `SCHEDULED`/`ACTIVE` real y no vencida en el mismo pool, es una regresión de este bug — repórtala, no debería volver a ocurrir con el código actual. Corrección manual de emergencia si hiciera falta:
```sql
UPDATE rotation_queue_entries SET status='ASSIGNED', version=version+1
WHERE pool_id='<poolId>' AND employee_id='<employeeId>';
```

**Nota de auditoría:** cualquier corrección manual directa contra `rotation_queue_entries` (por `wrangler d1 execute`, fuera del flujo de la aplicación) **no** genera fila en `audit_events` automáticamente (a diferencia de cualquier cambio hecho vía API, que sí queda registrado por diseño). Si se corrige manualmente `rotation_queue_entries.status` en producción, insertar también un evento correctivo en `audit_events` (actor, motivo, valores antes/después) para no dejar un hueco en la trazabilidad.

## 6. Auditoría e inmutabilidad

`audit_events` es append-only por trigger D1 (`audit_events_no_update`, `audit_events_no_delete`). Cualquier intento de `UPDATE`/`DELETE` — incluso directo contra D1 con el token de administración — se aborta con `SQLITE_CONSTRAINT_TRIGGER`. Esto se reverificó en producción durante la Tarea 7. No hay "modo de emergencia" para editar auditoría; si un registro está mal, se agrega un nuevo evento correctivo, nunca se edita el original.

## 7. Backup y restore

Ver `docs/BACKUP_RESTORE.md` para el procedimiento completo. Resumen:

```bash
bash scripts/backup-d1.sh      # exporta D1 remoto a backups/yrak-<timestamp>.sql
bash scripts/restore-d1.sh backups/yrak-<timestamp>.sql   # DESTRUCTIVO — sólo contra staging/base nueva
```

`scripts/backup-r2.sh` requiere el CLI `aws` instalado y credenciales S3-compatibles de R2 (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` generadas desde el dashboard de R2 — **no** el token de API de cuenta de Cloudflare). Verificar que ambos estén disponibles en la máquina que corra el backup antes de que existan archivos reales en `yrak-suterm-evidence` (al cierre de la Tarea 7 el bucket estaba vacío).

## 8. Cambiar de proveedor de IA

Anthropic (`claude-sonnet-5`) ya está completamente cableado como proveedor alterno en `api-worker` y `agent-worker`, sólo inactivo por falta de secreto:

```bash
cd apps/api-worker
pnpm exec wrangler secret put ANTHROPIC_API_KEY
```

y cambiar la variable `AI_PROVIDER` de `"compatible"` a `"anthropic"` en `wrangler.jsonc` (o el mecanismo de routing que corresponda — ver `docs/AI_PROVIDERS.md`). No requiere cambios de código. Ningún proveedor de IA tiene autoridad para decidir rotación, elegibilidad, ranking ni aprobar asignaciones — sólo transcribe/extrae/redacta (ver `docs/SECURITY_MODEL.md`).

## 9. Seguridad — recordatorios operativos

- El token de Cloudflare usado para desplegar/administrar este proyecto está **escopeado a toda la cuenta**. Rotarlo a un token acotado antes de manejar datos reales de empleados (pendiente bloqueado, ver `docs/RELEASE_CANDIDATE.md`).
- El bypass `DEV_AUTH_TOKEN` es la única autenticación disponible hoy. Cualquiera con ese token y un correo de un usuario provisionado puede actuar como esa persona. Rotarlo si se sospecha exposición, y desactivarlo en cuanto haya Cloudflare Access real.
- Nunca pegar secretos en este repo, en `wrangler.jsonc`, ni en logs. Usar siempre `wrangler secret put`.

## 10. Dónde seguir

- `docs/RELEASE_CANDIDATE.md` — estado de aceptación, resultado completo de TEST_MATRIX, pendientes bloqueados.
- `docs/CONNECTIONS.md` — qué está conectado y qué falta.
- `docs/DEPLOYMENT.md` — cómo desplegar cada componente.
- `docs/DECISIONES_PENDIENTES.md` — decisiones de política laboral que siguen sin definir oficialmente.
- `docs/SECURITY_MODEL.md` — modelo de autorización y fronteras de confianza.
- `docs/TEST_MATRIX.md` — matriz de pruebas de aceptación completa (fuente de la tabla de resultados en `RELEASE_CANDIDATE.md`).
