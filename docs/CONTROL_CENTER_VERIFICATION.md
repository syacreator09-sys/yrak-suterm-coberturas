# YRAK Control Center — Verification Protocol

Rama objetivo: `feature/control-center-v1`

Este protocolo es fail-closed: un fallo detiene la promoción de la rama. No usar GitHub Actions; ejecutar localmente con Claude Code/Codex o en un entorno de staging explícitamente autorizado.

## Gate 1 — Código

```bash
bash scripts/verify-control-center.sh
```

Este gate ejecuta instalación, typecheck, tests y build de `admin-web`, `api-worker` y del workspace raíz. También busca referencias a nombres de secretos server-side dentro del bundle fuente del navegador.

Resultado requerido: exit code 0.

## Gate 2 — D1 local

```bash
bash scripts/migrate-local.sh
bash scripts/verify-local.sh
```

Resultado requerido: exit code 0 y ninguna migración/invariante fallida.

## Gate 3 — Identidades sintéticas

Crear/provisionar usuarios de prueba separados para:

- ADMIN
- HR
- SUPERVISOR
- COMMITTEE
- OPERATOR
- AUDITOR
- EMPLOYEE

No reutilizar la misma dirección entre roles.

Configurar sólo en el shell local:

```bash
export API_BASE_URL=http://127.0.0.1:8787
export YRAK_ADMIN_EMAIL='...'
export YRAK_HR_EMAIL='...'
export YRAK_SUPERVISOR_EMAIL='...'
export YRAK_COMMITTEE_EMAIL='...'
export YRAK_OPERATOR_EMAIL='...'
export YRAK_AUDITOR_EMAIL='...'
export YRAK_EMPLOYEE_EMAIL='...'
node scripts/control-center-role-smoke.mjs
```

El script sólo hace GET. Por defecto se niega a probar hosts remotos.

Resultado requerido: todos los checks configurados PASS.

## Gate 4 — Scope de grupos

Usar al menos dos grupos sintéticos A/B:

1. SUPERVISOR-A sólo pertenece a A.
2. COMMITTEE-A sólo pertenece a A.
3. OPERATOR-A sólo pertenece a A.
4. Crear personal y coberturas sintéticas en A y B.
5. Verificar que los roles A nunca reciban metadata de B en listados, colas, auditoría ni reportes.
6. Verificar que ADMIN/HR/AUDITOR tengan el scope organizacional previsto.
7. Confirmar que emails de trabajadores no aparecen en listados/CSV de roles scoped.

Resultado requerido: cero fugas entre grupos.

## Gate 5 — Intake

Con dos usuarios operativos distintos:

1. Usuario A crea un draft.
2. Usuario B no debe verlo en `/v1/intake/drafts`.
3. B no debe poder abrir `/v1/intake/drafts/:id` de A.
4. B no debe poder procesar el attachment de A.
5. B no debe poder consumir el draft de A.
6. A abre el draft en el Dashboard; sólo después se habilita consumo.
7. El consumo vuelve a validar grupo y crea una sola cobertura incluso si se repite la petición.

Resultado requerido: ownership y revisión humana efectivos.

## Gate 6 — Rotación 1–5

Con política/calendario sintéticos:

1. Preview produce 1–5 días efectivos.
2. Proceso = ROTATION.
3. Dashboard sólo muestra la cola; no la modifica.
4. Selección se realiza vía motor backend.
5. Aprobación exige rol autorizado.
6. Cierre devuelve a nivel base.
7. Cancelación antes de inicio no consume turno cuando política lo indica.
8. Caso de cancelación iniciada usa el boolean explícito y queda auditado.
9. Dos solicitudes simultáneas no asignan de forma inconsistente.

Resultado requerido: reglas deterministas intactas.

## Gate 7 — Concurso 6+

1. Preview produce 6+ días efectivos.
2. Proceso = COMPETITION.
3. Evaluación usa requisitos reales del fixture.
4. Reglas del examen deben confirmarse.
5. Primera calificación se registra.
6. Cambio de calificación crea revisión pendiente.
7. El mismo usuario no puede aprobar su propia revisión.
8. Segundo usuario la aprueba o rechaza.
9. Ranking sólo lo calcula backend.
10. Adjudicación vuelve a validar revisiones, apelaciones y disponibilidad.
11. IA nunca aparece como adjudicador.

Resultado requerido: dual control y adjudicación humana efectivos.

## Gate 8 — Cloudflare Access staging

No ejecutar en producción primero.

Configurar:

- `APP_ENV=staging`
- `ACCESS_TEAM_DOMAIN=<team>.cloudflareaccess.com`
- `ACCESS_AUD=<application aud tag>`

Verificar:

1. petición sin `Cf-Access-Jwt-Assertion` => 401;
2. JWT expirado => 401;
3. `aud` incorrecto => 401;
4. `iss` incorrecto => 401;
5. firma incorrecta => 401;
6. JWKS/config no disponible => 503, no 401 engañoso;
7. JWT válido + usuario provisionado => acceso según rol;
8. header email que contradiga el claim => 401;
9. `x-yrak-user-email` remoto no concede acceso aunque exista por error en la petición.

La prueba 9 es obligatoria antes de producción. Si falla, no desplegar.

## Gate 9 — Navegador

Comprobar manualmente en desktop y móvil:

- shell/sidebar/topbar;
- búsqueda rápida;
- navegación por rol;
- loading/empty/error/ready;
- correlation ID en error cuando exista;
- confirmaciones críticas;
- anti-doble-submit;
- tablas y JSON con texto malicioso sintético (`<script>`, comillas, URLs) sin ejecución;
- CSP sin violaciones que rompan la app;
- `javascript:`/`data:` rechazados como destinos;
- Employee redirige sólo a URL configurada válida.

## Gate 10 — Exportaciones

Abrir CSV sintéticos en Excel/Sheets con celdas:

```text
=1+1
+1+1
-10
@SUM(A1:A2)
```

Resultado requerido: se muestran como texto y no se ejecutan como fórmulas.

## Gate 11 — IA

En development/staging con datos sintéticos:

- verificar provider/model mostrados sin keys;
- `ai-smoke-test` funciona con proveedor configurado;
- fallo del proveedor => 503 controlado;
- producción => smoke 403;
- prompts/documentos/keys no aparecen en telemetría del navegador.

## Gate 12 — RAG e integraciones

Hasta conectar Supabase/pgvector y pipeline:

- RAG debe seguir mostrando readiness, no healthy;
- botón de consulta permanece deshabilitado;
- integraciones configuradas sin health real aparecen `unknown`, no `healthy`.

Después de conectar RAG se requiere una validación separada de ACL, retrieval, reranking y citas antes de habilitar búsqueda en el Control Center.

## Gate final — promoción

Sólo cuando Gates 1–12 aplicables estén verdes:

1. comparar `main...feature/control-center-v1`;
2. revisar que la rama esté 0 commits detrás o rebase/actualizarla;
3. revisar diff completo;
4. crear PR con resultados exactos;
5. no usar force-push sobre `main`;
6. no desplegar producción antes de staging;
7. mantener backup/rollback definido.

La frase “todo correcto” sólo puede usarse después de observar estas verificaciones, no por inspección estática.
