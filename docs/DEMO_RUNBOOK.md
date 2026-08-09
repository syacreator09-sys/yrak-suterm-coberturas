# Guión de demo — YRAK SUTERM Coberturas (entorno demo)

**URLs del demo:**
- API: https://yrak-suterm-coberturas-api-demo.yrak-suterm.workers.dev
- Dashboard: https://yrak-admin-web-demo.pages.dev
- Portal del trabajador: https://yrak-employee-portal-demo.pages.dev

**Antes de cada ensayo:** `./scripts/demo/reset-demo.sh` (deja los datos ficticios frescos, sin coberturas/notificaciones de una corrida anterior). **Conocido:** este script no vacía la tabla `holidays` — cada corrida duplica los 14 feriados MX (14 → 28 → 42…). No lo corras más de una vez sin limpiar `holidays` a mano hasta que se corrija.

**Login:** correo `yrakelizalde9@gmail.com` (Secretario/ADMIN) o cualquier `yrakelizalde9+demo-emp-XX@gmail.com` (empleado), token `DEMO_DEV_AUTH_TOKEN` del scratchpad. Supervisor: `yrakelizalde9+demo-user-supervisor@gmail.com`.

---

## Nota de ensayo (leer antes de presentar)

Este guión fue ensayado en vivo contra el entorno `-demo` real el 2026-08-09 (ver `task-6-report.md` para la evidencia curl completa). Todo lo marcado **[ENSAYADO]** abajo se ejecutó de punta a punta contra la API real y produjo el resultado documentado. Todo lo marcado **[NO ENSAYADO — requiere correo/navegador]** no se pudo probar en ese pase porque el entorno de ejecución no tiene acceso al buzón real ni a un navegador; queda pendiente de una verificación manual antes de la primera presentación en vivo.

**Tres hallazgos bloquean partes de este guión tal como estaba escrito originalmente — corregidos abajo, pero léelos antes de presentar:**

1. **Acto 5.1 (Asistente IA) está roto ahora mismo.** `POST /v1/assistant` responde `400 {"error":"Unexpected token 'e', \"error code: 1042\n\" is not valid JSON"}` de forma 100% reproducible. Causa raíz: `assistant.ts` en el api-worker hace un `fetch()` directo de una URL `*.workers.dev` a otra URL `*.workers.dev` del mismo account (`AGENT_WORKER_URL`) — Cloudflare bloquea ese patrón worker-a-worker con el error 1042; requiere un Service Binding en vez de un fetch por URL. El agent-worker en sí funciona perfecto llamado directo (confirmado por curl). El mismo patrón de configuración existe en producción (`apps/api-worker/wrangler.jsonc`, bloque raíz), así que es probable que el asistente esté roto ahí también — **no verificado en producción en este pase, pero la config es idéntica.** No demostrar el Acto 5.1 en vivo hasta que se arregle. Ver Concern #1 del reporte de esta tarea.
2. **Acto 4 / SEC-01 no está protegido.** `GET /v1/coverage-cases` ignora por completo el query param `groupId` y nunca llama `assertGroupAccess` — cualquier rol permitido (incluido SUPERVISOR) ve **todos** los expedientes de **todos** los grupos de la organización, no solo el suyo. Confirmado creando un expediente en Comercial y viéndolo con la sesión del supervisor de Distribución. El resultado real es `200` con la lista completa, no `400 GROUP_FORBIDDEN`. No demostrar SEC-01 como "seguridad que funciona" hasta que se corrija — es un hallazgo de seguridad real, no un ejemplo positivo.
3. **El seed de Task B2 no incluye un segundo aprobador (`HR`/`COMMITTEE`).** El paso 3.7 (doble control de calificaciones) requiere un segundo usuario con rol distinto al que capturó/aprobó — solo existían `ADMIN` (Secretario) y `SUPERVISOR` (Distribución). Se creó en vivo `demo-user-committee` (`yrakelizalde9+demo-user-committee@gmail.com`, rol `COMMITTEE`, ambos grupos) vía `POST /v1/import/users` para poder ensayar el paso. **`scripts/demo/seed-demo.sh` debería incluir este usuario en su Paso 6** para que el guión sea reproducible después de un `reset-demo.sh`.

---

## Acto 1 — Configuración y calendario (5 min)

| Paso | Acción | Resultado esperado | Qué decir |
|---|---|---|---|
| 1.1 **[ENSAYADO]** | Dashboard → Calendario → Vista previa: grupo Distribución, 2026-09-03 a 2026-09-10 (lunes a lunes, 8 días naturales) | `8 días naturales, 6 días hábiles → CONCURSO` (el modo de conteo del grupo es `WORKING_DAYS`; 09-05/06 son sábado/domingo y no cuentan) | "Ocho días de calendario, pero el sistema cuenta días hábiles según el calendario real del grupo — aquí ya son 6, y 6+ sigue siendo concurso, regla dura del negocio." |
| 1.2 **[ENSAYADO con 3 feriados]** | Agregar feriados 2026-09-04, 09-05 y 09-06 al grupo Distribución, repetir la misma vista previa. (Usar solo 09-04 no se probó por separado — es inferencia lógica, ya que 09-05/06 caen en fin de semana y `WORKING_DAYS` ya los excluye del conteo; si se quiere un dato 100% ensayado, usar los 3.) | `5 días hábiles → ROTACIÓN` | "Con feriados agregados, el mismo rango cambia de clasificación — sin tocar código, sin SQL." |
| 1.3 **[ENSAYADO]** | Borrar el feriado temporal (limpieza) | vuelve a 6 días hábiles / 8 naturales → CONCURSO | — |
| 1.4 **[ENSAYADO vía API]** | Calendario → semana laboral de Comercial → mostrar 6 días marcados (L-S) | El mismo rango 09-03..09-10 da `7 días hábiles` en Comercial vs `6` en Distribución para el mismo rango, porque Comercial cuenta el sábado 09-05. `GET /v1/calendar/settings/:groupId` confirma `workingWeekdays:[1..6]` (Comercial) vs `[1..5]` (Distribución, default). Verificado vía API — no se abrió el dashboard visualmente en este ensayo (sin navegador disponible). **Nota aparte:** `GET /v1/calendar/group-shifts?groupId=...` devolvió `{"items":[]}` — es una tabla separada (`group_shift_dates`, para el modo `SHIFTS`) que NO respalda esta vista previa de semana laboral; si alguien la consulta durante la demo en vivo, esperar que salga vacía, no es un error. | "Comercial trabaja 6 días; Distribución 5 — cada grupo tiene su propia semana, versionada y auditada." |
| 1.5 **[ENSAYADO]** | Configuración → cambiar `rotationOfferTimeoutMinutes` de Comercial a 3 y volver a 2 | Cada `POST /v1/policies/groups/:id/coverage` crea una nueva versión (confirmado: v3 con timeout=3, v4 con timeout=2). La versión anterior no se sobreescribe: `GET /v1/audit/GROUP_POLICY/:policyId` muestra el evento `CREATED` de cada versión con su `config_json` completo (no existe un endpoint dedicado de "historial de política" — la auditoría es por entidad/versión). | "Cada cambio de regla queda versionado con fecha de vigencia — nunca se sobreescribe silenciosamente." |

## Acto 2 — Rotación corta con correo real (10 min)

| Paso | Acción | Resultado esperado |
|---|---|---|
| 2.1 **[ENSAYADO]** | Coberturas → Nuevo expediente: grupo Distribución, nivel 8, 2026-09-03 a 2026-09-04 (2 días hábiles) | `ROTATION`, `PENDING_VALIDATION` — confirmado exacto |
| 2.2 **[ENSAYADO]** | Cargar el expediente → "Seleccionar rotación" | Candidato con menor `queue_position` elegible ofertado (demo-emp-01, posición 1; demo-emp-05 excluido por `UNAVAILABLE_PERIOD`), `CANDIDATES_CALCULATED`. La oferta se crea con `offer_expires_at` = creación + exactamente 2 minutos (confirmado: `created_at 19:35:36` → `offer_expires_at 19:37:36`), validando que `rotationOfferTimeoutMinutes:2` de la política se aplica de verdad. |
| 2.3 **[NO ENSAYADO — requiere correo/navegador]** | Revisar el correo real recibido (Aceptar/Rechazar, vence en 2:00) | correo con botones firmados |
| 2.4 **[NO ENSAYADO — requiere correo/navegador]** | Abrir el portal del trabajador con la sesión del empleado ofertado | "Mis Ofertas" muestra countdown en vivo desde 2:00 |
| 2.5 **[NO ENSAYADO — requiere correo/navegador]** | Click "Aceptar" desde el correo | `SCHEDULED`; si `cascadeEnabled`, se abre automáticamente un expediente hijo en el nivel base del aceptante (el mecanismo de cascada sí se confirmó funcionando, ver Acto 3.11) |
| 2.6 **[ENSAYADO — vía API, equivalente al botón "Rechazar" del portal]** | Repetir 2.1-2.2 con otro rango; esta vez rechazar con `POST /v1/coverage-cases/:caseId/rotation/reject` autenticado como el empleado ofertado (sin correo — este es justo el camino que usa el botón del portal) | Cola reordenada: rechazante (demo-emp-02) al final (posición 6, `AVAILABLE` en la tabla real), resto del pool sin alterar — confirmado leyendo `GET /v1/config/rotation-pools/:poolId/queue` después del rechazo. **Nota menor:** el JSON de respuesta del propio `rotation/reject` trae el `availability` del rechazante desactualizado (`RESERVED` en vez de `AVAILABLE`) aunque el estado real en base de datos ya es correcto — cosmético, no bloqueante. |
| 2.7 **[NO ENSAYADO como prueba dirigida — confirmado de forma incidental]** | Repetir 2.1-2.2 una vez más y no responder — esperar 2 minutos | No se hizo la espera dirigida de 2 minutos. Pero mientras se ensayaban los Actos 3-5 (≈10 minutos reales), el cron de barrido de ofertas vencidas (`* * * * *` en el api-worker, ver `docs/RUNBOOK_AAH.md`) expiró y re-ofertó el expediente del paso 2.1 solo, sin intervención humana, tres veces seguidas: demo-emp-01 expiró 19:37:36 → demo-emp-03 ofertado (expiró 19:39:52) → demo-emp-04 ofertado (expiró 19:42:51) → demo-emp-06 ofertado. El salto de emp-01 a emp-03 (no emp-02) se debe a que emp-02 ya estaba al final de la cola por el rechazo del paso 2.6 — la interacción cruzada entre casos sobre el mismo pool es correcta. Esto demuestra el mecanismo de expiración/re-oferta a nivel de base de datos con evidencia real de timestamps, aunque no fue una prueba dirigida. **No se confirmó el envío del "segundo correo"** (sin acceso a bandeja) — sigue siendo `[NO ENSAYADO — requiere correo/navegador]` en ese aspecto. |

## Acto 3 — Concurso 6+ con los 3 fallos de elegibilidad (10 min)

> **Corrección de fechas respecto al guión original:** con la fecha real del ensayo (2026-08-09) y los datos del seed de Task B2, el rango `2026-10-05..2026-10-14` sugerido originalmente **no** reproduce el patrón documentado — `demo-req-cert-seguridad` de demo-emp-01 vence el 2026-06-01 y el de demo-emp-02 el 2026-07-01, ambos ya en el pasado para cualquier cobertura fechada después de hoy. Con esas fechas, los 6 candidatos salen `INELIGIBLE` (confirmado en vivo). El rango de abajo (`2026-08-24..2026-09-02`) sí reproduce un patrón mixto real con los datos actuales del seed. **Esta ventana se irá cerrando con el tiempo** (el vencimiento útil más lejano en el seed es el de demo-emp-03, 2026-09-05) — antes de cada presentación, verificar que el rango elegido siga terminando antes de esa fecha, o re-sembrar `employee_requirements` con `validUntil` más lejanos.

| Paso | Acción | Resultado esperado |
|---|---|---|
| 3.1 **[ENSAYADO, fechas corregidas]** | Coberturas → Nuevo expediente: Distribución, nivel 8, **2026-08-24 a 2026-09-02** (8 días hábiles) | `COMPETITION` — confirmado exacto |
| 3.2 **[ENSAYADO, resultado real distinto del guión original]** | Concursos → "Evaluar requisitos" con el `caseId` | Resultado real: demo-emp-01 → `INELIGIBLE` (`EXPIRED`, cert vencida 2026-06-01); demo-emp-02 → `INELIGIBLE` (`EXPIRED`, cert vencida 2026-07-01); demo-emp-03 → `ELIGIBLE` (cert vence 2026-09-05, después del fin de cobertura 2026-09-02 — este es el caso ELG-03 "al límite"); demo-emp-04 → `INELIGIBLE` (`MISSING` cert + `EXPIRED` curso); demo-emp-06 → `INELIGIBLE` (`MISSING` ambos). demo-emp-05 **no aparece en la lista de candidatos** — su vacación sembrada (2026-09-01 a 2026-09-10) se solapa con la cobertura y lo excluye antes de evaluar elegibilidad (comportamiento correcto, no es un fallo ELG). |
| 3.3 **[ENSAYADO]** | Participación: aceptar para los elegibles (aquí, solo demo-emp-03) | `accepted_participation=1` — confirmado |
| 3.4 **[ENSAYADO]** | Capturar calificaciones (88) | Primera captura sin revisión — confirmado, `{"updated":true,"score":88}` |
| 3.5 **[ENSAYADO]** | Re-capturar la misma calificación con un valor distinto (95) | `202 {"updated":false,"pendingApproval":true,"revisionId":...}`, revisión creada — **doble control**, confirmado exacto |
| 3.6 **[ENSAYADO]** | Intentar aprobar la revisión con el MISMO usuario que la creó | `409 {"error":"SECOND_APPROVER_REQUIRED"}` — confirmado exacto, mostrar el error en vivo |
| 3.7 **[ENSAYADO, requiere el usuario COMMITTEE agregado — ver Nota de ensayo]** | Aprobar con un segundo usuario/rol (`demo-user-committee`) | Revisión aprobada, `{"approved":true,"newScore":95}` — confirmado |
| 3.8 **[ENSAYADO]** | Confirmar reglas (`PATCH /config`), calcular ranking | Ranking por calificación → antigüedad como desempate; con un solo elegible, ranking trivial de 1 posición (demo-emp-03, score 95, rank 1) — confirmado |
| 3.9 **[ENSAYADO]** | Abrir una inconformidad sobre el ganador provisional | `appeals` con status `OPEN` — confirmado |
| 3.10 **[ENSAYADO]** | Intentar adjudicar (`award`) con la inconformidad abierta | `409 {"error":"OPEN_APPEALS_BLOCK_AWARD"}` — confirmado exacto |
| 3.11 **[ENSAYADO]** | Resolver la inconformidad, reintentar `award` | Asignación `SCHEDULED`, `{"awarded":true,"employeeId":"demo-emp-03","assignmentId":...}` — confirmado. **Bonus real:** con `cascadeEnabled:true`, el award creó automáticamente un expediente hijo en el nivel base del ganador (`cascade:{"processType":"COMPETITION","chainOrder":2}`) — buen momento para señalar la cascada en vivo sin necesidad de forzarla aparte. |

## Acto 4 — Seguridad y catálogo de fallos (10 min, todo por curl)

```bash
API=https://yrak-suterm-coberturas-api-demo.yrak-suterm.workers.dev
SUP="x-yrak-user-email: yrakelizalde9+demo-user-supervisor@gmail.com"
TOK="x-yrak-dev-token: $DEMO_DEV_AUTH_TOKEN"

# SEC-01 — NO PRESENTAR COMO "funciona bien": hallazgo real de seguridad, ver Nota de ensayo #2.
# GET /v1/coverage-cases ignora el query param groupId por completo y nunca llama assertGroupAccess.
curl -s "$API/v1/coverage-cases?groupId=demo-grupo-comercial" -H "$SUP" -H "$TOK"
# → resultado REAL confirmado: 200 con TODOS los expedientes de TODOS los grupos (no solo Comercial,
#   ni siquiera filtrado — el query param groupId se ignora). El guión original asumía 400 GROUP_FORBIDDEN;
#   eso NO ocurre hoy. Pendiente de fix antes de usar este ejemplo como demostración de seguridad.

# SEC-02 — un EMPLOYEE no puede listar todos los expedientes [ENSAYADO, confirmado exacto]
curl -s "$API/v1/coverage-cases" -H "x-yrak-user-email: yrakelizalde9+demo-emp-01@gmail.com" -H "$TOK"
# → 403 {"error":"FORBIDDEN"}

# Token de oferta inválido / vencido / ya resuelto [ENSAYADO]
curl -s "$API/offers/<assignmentId>/accept?token=tokenInventado"
# → siempre 409 con una página HTML genérica en español; el mensaje exacto depende de la causa real
#   (NOT_FOUND: "No se encontró la oferta.", EXPIRED: "...ya venció...", ALREADY_RESOLVED: "...ya fue
#   respondida...", INVALID_TOKEN: "El enlace no es válido."). Confirmado con un assignmentId inventado
#   (NOT_FOUND) y uno real ya resuelto/vencido (ALREADY_RESOLVED) — nunca expone datos del expediente.

# Inmutabilidad de auditoría
curl -s -X POST "$API/../d1-execute-attempt" # (mostrar en su lugar el intento documentado en RUNBOOK_AAH.md — no ejecutable por API pública)

# Idempotency-Key repetido [ENSAYADO, confirmado exacto]
curl -s -X POST "$API/v1/coverage-cases" -H "$SUP" -H "$TOK" -H "content-type: application/json" -H "idempotency-key: demo-fixed-key-001" -d '{"groupId":"demo-grupo-distribucion","targetLevelId":"demo-dist-n8","startDate":"2026-11-01","endDate":"2026-11-02"}'
curl -s -X POST "$API/v1/coverage-cases" -H "$SUP" -H "$TOK" -H "content-type: application/json" -H "idempotency-key: demo-fixed-key-001" -d '{"groupId":"demo-grupo-distribucion","targetLevelId":"demo-dist-n8","startDate":"2026-11-01","endDate":"2026-11-02"}'
# → segunda respuesta: {"idempotent":true,...} mismo id, sin duplicar (confirmado). Nota menor: el
#   payload de la respuesta idempotente usa snake_case (effective_days, process_type) mientras que la
#   respuesta de creación original usa camelCase (effectiveDays, processType) — inconsistencia cosmética.

# Bootstrap ya cerrado [ENSAYADO — ejemplo original corregido]
# El body vacío original ('{}') falla la validación Zod ANTES de revisar el token (organizationName y
# adminDisplayName requieren mínimo 2 caracteres) — usa un body válido:
curl -s -X POST "$API/bootstrap" -H "x-yrak-bootstrap-token: $DEMO_BOOTSTRAP_TOKEN" -H "content-type: application/json" -d '{"organizationName":"Otra Org","adminEmail":"otro@x.com","adminDisplayName":"Otro Admin"}'
# → 409 {"error":"BOOTSTRAP_ALREADY_COMPLETED"} (confirmado, con el token real)
# Con un token equivocado (p.ej. "cualquiera") y el mismo body válido: 401 {"error":"BOOTSTRAP_UNAUTHORIZED"}
# (confirmado) — buen comportamiento: no revela si el bootstrap ya se hizo a quien no trae el token correcto.
```

Explicar en vivo, sin curl (referenciar la tabla completa en `docs/RELEASE_CANDIDATE.md`): `TARGET_LEVEL_GROUP_MISMATCH`, `NO_ROTATION_CANDIDATE`, `WINNER_NO_LONGER_AVAILABLE`, `ACTIVE_ROTATION_CONSUMED_TURN_REQUIRED`, `LEVEL_TRANSITION_NOT_ALLOWED`, `ROTATION_REJECTION_ONLY_BEFORE_APPROVAL`. Los seis códigos existen tal cual en el código (`apps/api-worker/src/services/*`, `apps/api-worker/src/routes/*`, `packages/rotation/src/rotation-engine.ts`, `packages/assignments/src/assignment-engine.ts`) — verificado por grep, no requieren corrección.

## Acto 5 — IA y cierre (5 min)

| Paso | Acción | Resultado esperado |
|---|---|---|
| 5.1 **[ROTO — no presentar hasta corregir, ver Nota de ensayo #1]** | Asistente IA → preguntar "¿cuántos días aplican a rotación en Comercial?" | Falla 100% reproducible: `400 {"error":"Unexpected token 'e', \"error code: 1042\n\" is not valid JSON"}`. Causa: fetch worker-a-worker entre dos subdominios `*.workers.dev` del mismo account, bloqueado por Cloudflare (error 1042); requiere Service Binding. El agent-worker funciona perfecto llamado directo. |
| 5.2 **[ENSAYADO]** | Documentos/IA → pegar un texto de incidencia de ejemplo → "Crear borrador" | Borrador extraído con campos estructurados — confirmado con un texto de ejemplo ("cobertura para Distribución, nivel 8, del 3 al 4 de septiembre de 2026 por incapacidad"): `{"group":"Distribución","targetLevel":8,"startDate":"2026-09-03","endDate":"2026-09-04","reason":"incapacidad del titular","employeeReference":null}`, `status:"PENDING_REVIEW"`. Este camino usa el proveedor de IA directo (NVIDIA NIM), no el agent-worker — por eso no le afecta el problema del paso 5.1. |
| 5.3 **[ENSAYADO]** | Reportes → descargar CSV de auditoría | Bitácora completa de TODO lo hecho en el demo, exportable — confirmado: `GET /v1/reports/audit.csv` devuelve `text/csv`, `content-disposition: attachment; filename="audit.csv"`, 39 eventos reales de auditoría del ensayo (política, feriados, expedientes, ofertas, revisiones, apelaciones, adjudicación). |

---

## Checklist previo a cada presentación

- [ ] `./scripts/demo/reset-demo.sh` corrido en los últimos 30 minutos — **cuidado con `holidays`, ver nota al inicio de este documento**
- [ ] Verificar `GET /health` y `GET /ready` del entorno demo
- [ ] Verificar `POST /v1/assistant` con una pregunta de prueba — **si sigue devolviendo el error 1042, omitir el Acto 5.1 del guión en vivo**
- [ ] Confirmar acceso al buzón `yrakelizalde9@gmail.com` para mostrar correos en vivo
- [ ] Tener el `caseId`/`assignmentId` de al menos un caso ya en `PROPOSED` como respaldo si el timer de 2 min se vence antes de tiempo durante la demo en vivo
- [ ] Confirmar que existe el usuario `demo-user-committee` (rol `COMMITTEE`) para el Acto 3.7 — si `reset-demo.sh`/`seed-demo.sh` no lo recrean todavía, volver a crearlo con `POST /v1/import/users`
- [ ] Si el Acto 3 se presenta, confirmar que el rango de fechas elegido termina antes del próximo vencimiento útil en `employee_requirements` (hoy: 2026-09-05, cert de demo-emp-03) para que el patrón de elegibilidad siga siendo interesante
