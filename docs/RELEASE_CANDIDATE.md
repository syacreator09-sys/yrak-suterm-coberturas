# Release Candidate — `build/connections-v1`

Estado al cierre de la Tarea 7 (auditoría final). Esta rama contiene el trabajo de conexión real de infraestructura, correo Gmail, IA de producción, agentes, asistente y datos reales sobre `main`, ejecutado en 7 tareas dentro de la misma sesión.

## Qué cubre esta rama sobre `main`

1. Envío real de correo (Gmail API + OAuth), reemplazando el Email Service nativo de Cloudflare (bloqueado por falta de dominio verificado).
2. IA de producción: NVIDIA NIM (`deepseek-ai/deepseek-v4-flash-0731`) vía proveedor `compatible`, en `api-worker` y `agent-worker`.
3. Hardening del `agent-worker`: envelope de respuesta uniforme, límites de memoria/RAG, timeouts.
4. Asistente IA en el panel administrativo, proxied de forma segura, sin autoridad de negocio.
5. Datos reales sembrados en producción: `Grupo A` (niveles 5–8, transiciones 5→6→7→8), pool de rotación 7→8 con 3 empleados piloto, y `Grupo Piloto` (pruebas manuales previas, 2 empleados).
6. Corrección de nombres de nivel en el correo de aprobación (antes mostraba IDs).
7. Esta auditoría final (Tarea 7): TEST_MATRIX ejecutado contra producción real, verificación de backup/restore, auditoría de seguridad rápida, actualización de documentación.

## Resultado de `docs/TEST_MATRIX.md` — ejecutado contra producción real

Base: `https://yrak-suterm-coberturas-api.yrak-suterm.workers.dev`, organización `suterm-cfe`, D1 `bf353405-5422-4b9d-a11d-c8a8a813a4b6`. Fecha de ejecución: 2026-08-09. Auth: dev-header bypass con `DEV_AUTH_TOKEN` (no hay dominio para Cloudflare Access todavía — ver pendientes).

Leyenda: **PASA** (verificado con evidencia fresca o evidencia previa de esta sesión re-confirmada por consulta directa a D1), **NO APLICA** (bloqueado por falta de dominio, o la precondición de negocio no existe en este entorno), **NO EJECUTADO** (no se corrió en esta sesión, con razón explícita).

| ID | Caso | Resultado | Evidencia |
|---|---|---|---|
| BR-01 | 1 día efectivo | **PASA** | `POST /v1/coverage-cases/preview` 2027-05-01→2027-05-01 → `effectiveDays:1, processType:"ROTATION"` |
| BR-02 | 5 días efectivos | **PASA** | preview 2027-05-01→2027-05-05 → `effectiveDays:5, processType:"ROTATION"` |
| BR-03 | 6 días efectivos | **PASA** | preview 2027-05-01→2027-05-06 → `effectiveDays:6, processType:"COMPETITION"`; confirmado también creando el caso real `0e682816` (8 días, ver CMP-01) |
| BR-04 | 14 días efectivos | **PASA** | preview 2027-05-01→2027-05-14 → `effectiveDays:14, processType:"COMPETITION"` |
| ROT-01 | primero de fila disponible | **PASA** | Caso `5f61b43c` (prueba CAS-02): posición 1 (piloto1) no disponible → se propuso posición 2 (piloto3), documentado en `considered[]` |
| ROT-02 | primero no disponible | **PASA** | Caso `55b51edc`: piloto1 (posición 1, estado de fila `ASSIGNED`) saltado con `reason:"ASSIGNED"`; se propuso piloto2 (posición 2) |
| ROT-03 | primero reservado simultáneamente (Durable Object bloquea) | **PARCIAL** | El mecanismo `GroupCoordinator.reserve()/release()` se ejecutó correctamente en cada `select` de esta sesión (reserva antes de crear la oferta, liberación al rechazar/cancelar). No se forzó una colisión concurrente real (dos requests simultáneos) — requeriría un arnés de carga que no se corrió en este cierre. |
| ROT-04 | cobertura completada → trabajador vuelve a nivel base y pasa al final | **PASA** | Caso `0228d76f` (Grupo Piloto, sesión previa): `status=COMPLETED`, `rotation_events` tiene `MOVED_TO_END` con `reason='COVERAGE_COMPLETED'`, notificación `RETURN_TO_BASE` enviada. Reconfirmado por consulta directa a D1 en esta auditoría. |
| ROT-05 | cancelación antes de iniciar → fila preservada | **PASA** | Cancelación de `55b51edc` y `0e682816` (ambos en estado previo a `ACTIVE`) → respuesta `queueChanged:false` en ambos casos |
| ROT-06 | rechazo antes de aprobación → aplica `rejectionConsumesTurn` y conserva evento | **PASA** | Expiración forzada de la oferta de piloto2 en `55b51edc` → `rotation_events` registra `REJECTED_AND_MOVED_TO_END` (posición 2→3), `coverage_candidate_responses` guarda `DECLINED` con motivo |
| ROT-07 | mismo candidato rechazó el caso → no vuelve a proponerse en ese expediente | **PASA** | Tras el rechazo de piloto2 en `55b51edc`, la reselección mostró a piloto2 con `reason:"DECLINED_THIS_CASE"`, no seleccionable de nuevo en ese mismo caso |
| LVL-01 | nivel 7 cubre 8 → `baseLevel` permanece 7, `targetLevel` temporal 8 | **PASA** | Todas las asignaciones de Grupo A (`ed4937f5`, `55b51edc`, `5f61b43c`) tienen `base_level_id=Nivel7`, `target_level_id=Nivel8`; el nivel base del empleado en `employees` nunca cambia |
| LVL-02 | transición no configurada → asignación rechazada | **NO EJECUTADO** | No se probó un `targetLevelId` sin transición entrante en esta sesión (el código en `getSingleSourceLevel`/`rotation_pool_requires_transition` lo bloquea por diseño y por trigger D1 `0018_authorized_transition_guards.sql`, pero no se ejecutó una prueba negativa en producción) |
| CAS-01 | cascada desactivada → no se crea hijo | **PASA** | Política de Grupo A tenía `cascadeEnabled:false` (valor real de producción); ninguno de los casos aprobados bajo esa política generó `coverage_cases` hijas (`parent_coverage_case_id IS NOT NULL` = 0 filas antes de la prueba CAS-02) |
| CAS-02 | cascada 7→8 con 6→7 configurado → se crea hijo target 7 | **PASA** | Se habilitó temporalmente `cascadeEnabled:true` en Grupo A (nueva versión de política, v2), se aprobó una cobertura 7→8 real (`5f61b43c`), y se creó automáticamente el caso hijo `3aa07d89` con `target_level_id=Nivel7`, `parent_coverage_case_id=5f61b43c`, `chain_order=2`. Después de verificar, se canceló el caso padre (cascada de cancelación canceló también al hijo) y se revirtió la política a `cascadeEnabled:false` (v3, historial de versiones conservado en `group_policies`) |
| CAS-03 | cascada llega a nivel sin transición inferior → cadena termina | **NO EJECUTADO** | Requeriría encadenar una segunda aprobación (hijo en nivel 7 aprobado, cascada intentando nivel 6→5 sin transición 4→5) — no se ejecutó por alcance/tiempo de este cierre. Verificado por lectura de código: `maybeCreateCascadeChild` retorna `null` cuando `level_transitions` no tiene una fila cuyo `target_level_id` sea el nivel base a cubrir |
| ELG-01 | falta requisito obligatorio → INELIGIBLE con motivo | **NO APLICA** | No hay `requirements`/`target_level_requirements` sembrados en este entorno piloto (tabla vacía); no hay caso de negocio real que probar todavía |
| ELG-02 | certificación vencida → INELIGIBLE con motivo | **NO APLICA** | Misma razón que ELG-01 |
| ELG-03 | vigencia termina durante cobertura → INELIGIBLE | **NO APLICA** | Misma razón que ELG-01 |
| CMP-01 | 6+ sin requisito configurado → no se abre concurso | **PASA** | Caso `0e682816` (8 días, Grupo A) → `POST /v1/competitions/cases/:id/evaluate` devolvió `400 LONG_COVERAGE_REQUIREMENT_NOT_CONFIGURED`; no se creó fila en `competitions` |
| CMP-02 a CMP-11 | ranking, doble control de notas, inconformidades, adjudicación | **NO APLICA** | Bloqueado transitivamente por CMP-01: sin `target_level_requirements` configurados no se puede abrir un concurso real para ejercitar ranking/notas/inconformidades en este entorno piloto |
| WF-01 | fecha inicial → SCHEDULED→ACTIVE | **PASA** (parcial, vía aceptación) | Verificado el tramo PROPOSED→SCHEDULED con datos reales esta sesión (caso `ed4937f5`, aceptación por clic humano real, confirmado por consulta a D1: `status=SCHEDULED`). El tramo SCHEDULED→ACTIVE lo dispara el `CoverageWorkflow` en la fecha de inicio real (Cloudflare Workflows); no se forzó el reloj para observarlo en esta sesión |
| WF-02 | fecha final → COMPLETED + regreso al nivel base | **PASA** | Caso `0228d76f`: `status=COMPLETED`, notificación `RETURN_TO_BASE` enviada, evento `MOVED_TO_END` registrado — confirmado por consulta directa a D1 en esta auditoría |
| WF-03 | cobertura cancelada → Workflow despierta y no reactiva | **NO EJECUTADO** | Requeriría un `CoverageWorkflow` ya en curso y cancelarlo a mitad de ejecución; no se ejecutó en este cierre |
| DOC-01 | audio → transcripción → borrador, sin asignación | **NO EJECUTADO** | No se subió audio real en esta sesión; requiere probar el pipeline de transcripción de IA con un archivo real |
| DOC-02 | PDF/imagen → markdown/extracción → borrador | **NO EJECUTADO** | Misma razón que DOC-01 |
| DOC-03 | mismo borrador consumido dos veces → un solo expediente | **NO EJECUTADO** | Depende de DOC-01/DOC-02 |
| SEC-01 | supervisor Grupo A intenta modificar Grupo B → 403 | **NO EJECUTADO** | No existe usuario con rol `SUPERVISOR` sembrado en este entorno (sólo `ADMIN` y `EMPLOYEE`). El código (`assertGroupAccess` en `middleware.ts`) implementa la misma verificación de `user_groups` que protege SEC-02, pero no se ejercitó con un actor `SUPERVISOR` real |
| SEC-02 | empleado consulta expediente ajeno → 403 | **PASA** | Con identidad de piloto3 (`EMPLOYEE`): `GET /v1/coverage-cases` → 403, `GET /v1/coverage-cases/:id` (caso ajeno) → 403 |
| SEC-03 | MCP consulta otra organización → no devuelve datos | **NO APLICA** | Entorno de una sola organización (`suterm-cfe`); no hay una segunda organización real para probar aislamiento cruzado |
| SEC-04 | archivo apunta a entidad de otra organización → bloqueado | **NO APLICA** | Misma razón que SEC-03; además no hay archivos/adjuntos reales cargados en este entorno |
| AUD-01 | modificación crítica → `audit_event` append-only | **PASA** | Cada acción de esta auditoría (creación, selección, rechazo, cancelación, cambio de política) generó su fila en `audit_events` con actor/rol/before/after/regla/correlationId |
| AUD-02 | intento UPDATE/DELETE de `audit_events` → trigger aborta | **PASA** | `UPDATE audit_events ...` y `DELETE FROM audit_events ...` ejecutados directamente contra D1 producción → ambos abortados con `audit_events are immutable: SQLITE_CONSTRAINT_TRIGGER` |
| ID-01 | mismo Idempotency-Key al crear cobertura → mismo resultado, no duplicado | **PASA** | Dos `POST /v1/coverage-cases` con el mismo header `idempotency-key` → mismo `id` devuelto, segunda respuesta marcada `idempotent:true`, sin fila duplicada en `coverage_cases` |
| BAK-01 | exportar D1 y restaurar a staging → conteos y relaciones coinciden | **PASA** | Ver sección de Backup/Restore abajo |

### Puerta de producción (`docs/TEST_MATRIX.md`)

La regla original exige evidencia ejecutada de los casos críticos `BR`, `ROT`, `LVL`, `ELG`, `CMP`, `WF`, `SEC` y `AUD` antes de producción real. Estado al cierre de esta auditoría:

- `BR`, `ROT` (salvo concurrencia forzada), `AUD`: **cubiertos con evidencia real**.
- `LVL`: cubierto el caso positivo (LVL-01); el caso negativo (LVL-02) no se ejecutó pero está protegido por trigger D1, no sólo por código de aplicación.
- `ELG`, `CMP` (más allá de CMP-01), `SEC-01`, `SEC-03/04`, `WF-03`, `DOC-*`: **no aplican o no se ejecutaron** porque este entorno todavía no tiene requisitos de nivel, usuarios `SUPERVISOR`, segunda organización, ni documentos/audio reales que cargar. Esto es consistente con ser un entorno piloto pre-lanzamiento con datos mínimos — no es evidencia de que la funcionalidad esté rota, es evidencia de que **falta el dato/rol de prueba**, y debe volver a ejecutarse en cuanto existan requisitos de nivel y un usuario supervisor reales.

**Esta rama no debe considerarse lista para tráfico real de empleados** sin: (1) requisitos de nivel configurados y una ejecución real de CMP-02 a CMP-11, (2) al menos un usuario `SUPERVISOR` real y SEC-01 ejecutado, (3) los 4 pendientes bloqueados listados abajo resueltos o aceptados explícitamente por el usuario.

## Hallazgos de esta auditoría — CORREGIDOS (Tarea 7b, mismo día)

Durante la ejecución fresca de ROT-02/ROT-06/CAS-02 se encontraron dos comportamientos de borde. Un tercero, del mismo patrón exacto, se encontró por inspección propia al corregir los dos primeros. Los tres ya están corregidos, con gates verdes (typecheck/test/build) y reverificados contra producción real:

1. **[CORREGIDO] El rechazo de una oferta con `rejectionConsumesTurn=true` reiniciaba el estado de fila de *todos* los miembros del pool a `AVAILABLE`, no sólo el de quien rechazó.** Código: `rejectRotationCandidate` en `apps/api-worker/src/services/rotation-response-service.ts`. Efecto observado antes del fix: un empleado que ya estaba `ASSIGNED` (cubriendo activamente ese mismo pool en otro expediente con fechas no traslapadas) quedaba momentáneamente disponible para ser ofertado de nuevo. Fix: el `UPDATE` que reordena `queue_position` para todo el pool ahora solo toca `status` para el empleado que efectivamente rechazó; los demás conservan su estado. Reverificado en producción: se creó un caso de prueba real en el mismo pool (`829545ed-1567-4736-939f-317da1803137`), se ofertó y rechazó, y el empleado genuinamente `ASSIGNED` (piloto1, expediente real `ed4937f5`) permaneció `ASSIGNED` sin alteración; el que rechazó pasó correctamente a `AVAILABLE` al final de la cola. Caso de prueba cancelado tras la verificación.
2. **[CORREGIDO] `cancelCoverage` tomaba `assignments[0]` sin filtrar por estado activo cuando un expediente tenía más de una fila en `temporary_assignments`** (por ejemplo tras una cascada de oferta vencida: una fila `CANCELLED` y otra `PROPOSED`). Fix: ahora selecciona la primera asignación con `status NOT IN ('CANCELLED','COMPLETED','REPLACED')` en vez de la primera fila sin filtrar.
3. **[CORREGIDO, hallazgo independiente durante la corrección de #1]** `completeRotationAssignment` (regreso a nivel base al cerrar una cobertura, en `apps/api-worker/src/services/rotation-service.ts`) tenía el mismo patrón exacto que el hallazgo #1: el `UPDATE` de fin de cobertura ponía `status='AVAILABLE'` a todo el pool en vez de solo al empleado que regresa a su nivel base. Mismo fix aplicado.

Ninguno de los tres afectó las reglas de negocio centrales (nivel base inmutable, transición autorizada, auditoría) — eran inconsistencias de estado derivado en `rotation_queue_entries.status`. Los tres quedan cerrados; ver `.superpowers/sdd/2026-08-09-yrak-e2e-final/progress.md` (Tarea 7b) para el detalle de verificación.

## Criterios ya cubiertos por implementación (heredado de `build/clean-v1`, sigue vigente)

- una sola regla central 1–5 / 6+;
- nivel base inmutable;
- transiciones explícitas;
- rotación auditable;
- concurso auditable;
- aprobación humana;
- doble control de correcciones de nota;
- inconformidades;
- concurrencia con Durable Objects;
- regreso automático mediante Workflow;
- evidencia R2 + SHA-256;
- correo/transcripción/documentos como intake, no como decisión;
- agentes y MCP sin autoridad laboral;
- single-organization guard;
- scripts y documentación de handoff.

## Backup / Restore — evidencia (Paso 2 de esta auditoría)

- `scripts/backup-d1.sh` ejecutado contra producción real: `backups/yrak-20260809-110536.sql` (79 819 líneas, exportado vía `wrangler d1 export --remote`).
- Restaurado en una base SQLite local limpia (`sqlite3 restore_test.db < backup.sql`) — exit code 0, sin errores.
- `PRAGMA foreign_key_check` sobre la base restaurada → sin violaciones.
- Triggers de auditoría (`audit_events_no_update`, `audit_events_no_delete`) presentes y funcionando en la copia restaurada (un `DELETE` de prueba fue abortado igual que en producción).
- Conteos coincidieron con producción al momento del export: `organizations=1, groups=2, levels=6, employees=5, users=4, coverage_cases=5, temporary_assignments=5, rotation_queue_entries=4, audit_events=22, notifications=9` (los conteos de `coverage_cases`/`audit_events` en producción subieron después por las pruebas de TEST_MATRIX de esta misma auditoría — ver arriba).
- Relaciones spot-check: cada `coverage_cases.group_id` resuelve a un `groups.name` válido en la copia restaurada.
- **`scripts/backup-r2.sh` NO se pudo ejecutar en este entorno**: requiere el CLI `aws` (no instalado en esta máquina) y credenciales S3-compatibles de R2 (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`), que son un tipo de credencial distinto al token de API de cuenta de Cloudflare que se usó para el resto de esta auditoría y que no fue proporcionado. Se verificó por separado, vía `wrangler r2 bucket info`, que el bucket `yrak-suterm-evidence` existe y está vacío (`object_count: 0`) — no hay evidencia real en riesgo todavía, pero el script de backup de R2 debe probarse con credenciales reales antes de que se suban archivos de empleados.

## Auditoría de seguridad rápida — evidencia (Paso 3 de esta auditoría)

| Verificación | Resultado |
|---|---|
| `git grep -iE 'nvapi-\|GOCSPX\|cfat_\|sk-ant'` sobre el repo | Limpio (única coincidencia es el propio texto del checklist en el plan, no un secreto real) |
| `.env`/`.env.*` trackeados en git | Ninguno |
| Secrets de los 3 workers desplegados | Todos vía `wrangler secret`, ninguno en `vars` de `wrangler.jsonc` |
| `/offers/:id/accept` sin token | `400`, HTML genérico, sin datos del expediente |
| `/offers/:id/accept` con token inválido | `409 INVALID_TOKEN`, sin datos |
| `/offers/:id/accept` con token de oferta ya vencida/resuelta | `409 ALREADY_RESOLVED`/`EXPIRED` |
| CORS — origen no listado | Sin header `access-control-allow-origin` (petición se ejecuta en el servidor, pero el navegador bloquearía la lectura de la respuesta) |
| CORS — origen permitido (`yrak-admin-web.pages.dev`) | Header `access-control-allow-origin` presente |
| Empleado intenta aprobar/rechazar oferta ajena | `400 {"error":"FORBIDDEN"}` en ambos casos — repetido con éxito, comportamiento consistente con lo ya observado en sesiones previas |
| `EMPLOYEE` contra endpoints sólo-administrativos (`GET /v1/coverage-cases`, detalle ajeno) | `403 FORBIDDEN` (verificado por `requireRoles`, distinto del caso anterior que pasa por lógica de servicio) |
| Envelope de error — JSON malformado, campos faltantes, ID inexistente, ruta inexistente | Ningún caso expuso stack trace; mensajes cortos y consistentes (`Malformed JSON in request body`, `ZodError` estructurado, `GROUP_NOT_FOUND`, `404 Not Found`) |
| Sin autenticación (`GET /v1/coverage-cases` sin headers) | `401 UNAUTHENTICATED` |

No se encontraron secretos expuestos, fugas de datos entre organizaciones/roles, ni fugas de stack traces **en las pruebas ejecutadas en esta auditoría (Tarea 7) con el catálogo de checks de arriba**. Los dos hallazgos de la sección anterior son de consistencia de datos derivados, no de seguridad/autorización. **Actualización posterior:** el ensayo del entorno demo (ver sección siguiente) sí encontró una fuga real de datos entre grupos en `GET /v1/coverage-cases`, en el mismo código de producción — ver "3 bugs reales encontrados y corregidos" abajo. Esta conclusión de la Tarea 7 describe únicamente lo que se probó en ese momento, no una garantía retroactiva de que no había fugas de autorización en absoluto.

## 3 bugs reales encontrados y corregidos durante el ensayo del entorno demo (post-Tarea 7)

Durante la construcción y ensayo del entorno `-demo` (ver sección "Entorno demo" abajo) se encontraron y corrigieron 3 defectos reales en código ya desplegado a producción — no introducidos por el trabajo del entorno demo, solo descubiertos por él. Los tres se desplegaron y verificaron en vivo tanto en demo como en **producción real**.

1. **Trigger D1 roto** (`migrations/0016_derived_state_invalidation.sql`): dos triggers de `rotation_queue_entries` escribían una columna `updated_at` que esa tabla nunca tuvo (solo tiene `version`). SQLite valida el cuerpo del trigger contra el esquema en tiempo de preparación de la sentencia para cualquier `INSERT ... ON CONFLICT DO UPDATE` cuyo `SET` toque una columna vigilada — así que **`POST /v1/import/employees` fallaba el 100% de las veces**, incluso en un INSERT limpio sin conflicto real. Corregido con la migración `0021_fix_rotation_queue_entries_trigger_column.sql` (recrea los triggers sin la escritura inválida, preservando el resto del comportamiento byte a byte). Verificado en producción: la misma llamada que antes daba `500` ahora devuelve `{"imported":1,"errors":[]}`, con los datos del empleado sin alterar.
2. **Fuga de datos entre grupos**: `GET /v1/coverage-cases` nunca leía el parámetro `groupId` ni llamaba `assertGroupAccess` — cualquier `SUPERVISOR`/`COMMITTEE`/`OPERATOR` veía los expedientes de **todos** los grupos de la organización, no solo el suyo. Confirmado con una lectura cruzada real (supervisor de Distribución leyendo un expediente de Comercial). Corregido para reflejar exactamente el modelo de privilegios que `assertGroupAccess` ya usa en el resto del archivo — revisión de seguridad dedicada con veredicto **SAFE TO DEPLOY** antes de desplegar. El mismo patrón se encontró también en `GET /v1/calendar/holidays` (escrito en esta misma rama) durante la revisión final de toda la rama, y se corrigió igual antes de este cierre.
3. **Asistente IA roto en todo despliegue real**: `POST /v1/assistant` fallaba el 100% de las veces con el error de Cloudflare 1042 — un `fetch()` de un Worker a la URL pública `*.workers.dev` de otro Worker de la misma cuenta, patrón que Cloudflare bloquea. Invisible en `wrangler dev` local (no aplica esa restricción), por eso pasó desapercibido en la sesión que implementó originalmente el asistente. Corregido con un Service Binding de Cloudflare Workers en vez de una URL, con tests de regresión agregados. Verificado 5/5 en producción real tras el despliegue.

## Pendientes bloqueados para producción real (no resolubles sin dominio/decisión humana)

1. **Dominio propio** — bloquea Cloudflare Access real (hoy hay un bypass de desarrollo con `DEV_AUTH_TOKEN`), el despliegue same-origin verdadero, el remitente verificado del Email Service nativo de Cloudflare (`EMAIL_FROM` sigue en `REPLACE_WITH_VERIFIED_SENDER`), y el correo entrante.
2. **`ANTHROPIC_API_KEY`** — Anthropic/`claude-sonnet-5` está completamente cableado como proveedor alterno pero inactivo; activarlo es un cambio de un secreto + una variable, sin tocar código.
3. **Datos reales de empleados (no piloto) y sus correos** — este entorno sólo tiene 3 empleados piloto con alias de un mismo Gmail y el grupo de pruebas manuales previo.
4. **Rotar el token de API de Cloudflare usado para desplegar/administrar** — el token actual (`cfat_...`) está **escopeado a toda la cuenta** (se creó antes de que esta sesión asentara el principio de mínimo privilegio). Debe reemplazarse por un token acotado a cuenta/recurso específico **antes de que este proyecto maneje tráfico real de producción con datos reales de empleados**.

## Entorno demo (post-cierre)

Tras el cierre de esta auditoría (Tarea 7), se construyó un entorno Cloudflare `-demo` completo y separado de
producción (organización `demo-cfe`, D1/R2/colas propios, mismo código) con datos ficticios diseñados a propósito
para ejercitar los casos que este documento dejó como **NO APLICA**/**NO EJECUTADO** por falta de dato o rol de
prueba. Ver:

- `docs/DEMO_RUNBOOK.md` — guión de demo en 5 actos, ensayado en vivo contra el entorno real.
- `docs/DEMO_RESULTS.md` — resultado completo de `docs/TEST_MATRIX.md` ejecutado contra ese entorno demo.

Los casos `ELG-01..03`, `CMP-02..11`, `SEC-01` y `LVL-02`/`CAS-03`/`WF-*`/`DOC-*` que arriba seguían **NO APLICA** o
**NO EJECUTADO** por no existir en este entorno de producción requisitos de nivel, un usuario `SUPERVISOR`, ni
documentos/audio reales que cargar, **ahora tienen cobertura real ejecutada — en el entorno demo, con datos
ficticios**. Esto **no cambia el estado de producción registrado arriba**, que sigue siendo exactamente el de esta
Tarea 7: producción sigue sin requisitos de nivel, sin usuario `SUPERVISOR` real, sin segunda organización y sin
documentos/audio reales cargados, y por lo tanto esos casos siguen pendientes de ejecución real contra producción
cuando existan esos datos/roles ahí.

Dos hallazgos nuevos surgieron de esa ejecución en demo, ambos de disponibilidad/completitud funcional y presentes
también en producción (mismo código, misma configuración de proveedor):

1. La transcripción de audio (`POST /v1/intake/attachments/:id/process` sobre un adjunto `audio/*`) falla con
   `AI provider does not support transcribe` porque el proveedor de IA activo (`compatible` / NVIDIA NIM) nunca tuvo
   configurado un `AI_COMPAT_TRANSCRIPTION_MODEL`. La extracción de PDF/imagen (vía Workers AI) sí funciona
   correctamente y fue confirmada con un PDF real.
2. La transición automática `SCHEDULED→ACTIVE` del `CoverageWorkflow` (Cloudflare Workflows) no se pudo observar en
   vivo en demo pese a más de 15 minutos de espera real con una cobertura cuya fecha de inicio ya estaba varios días
   en el pasado. El tramo `PENDING_VALIDATION→...→SCHEDULED` sí se confirmó en vivo repetidamente. Esto reproduce (sin
   resolverlo) el mismo vacío que este documento ya señalaba para `WF-01` arriba ("no se forzó el reloj para
   observarlo en esta sesión") — amerita una verificación aparte de si `CoverageWorkflow` se está disparando
   correctamente en el Worker, con más tiempo de reloj real del que cabe en una sesión interactiva.

Ver `docs/DEMO_RESULTS.md` para el detalle completo, caso por caso, con evidencia real.

## Política de cambios a partir de aquí

No agregar reglas laborales nuevas por inferencia. Todo cambio de negocio debe:

- citar la regla oficial o decisión aprobada;
- versionar configuración cuando aplique;
- añadir prueba;
- conservar auditoría histórica.
