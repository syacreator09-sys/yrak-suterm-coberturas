# YRAK Control Center — Security Baseline

Fecha: 2026-08-07
Rama: `feature/control-center-v1`

Este documento congela las propiedades de seguridad que deben mantenerse al conectar infraestructura. No constituye evidencia de que el monorepo completo haya pasado typecheck/tests/build/E2E.

## 1. Identidad y autenticación

### Development

- `APP_ENV=development` permite `x-yrak-user-email` exclusivamente para pruebas locales.
- El frontend sólo envía `VITE_DEV_USER_EMAIL` cuando Vite compila en modo DEV.
- Este mecanismo no debe usarse en staging ni producción.

### Staging / Production

- `ACCESS_TEAM_DOMAIN` y `ACCESS_AUD` son obligatorios.
- La API exige `Cf-Access-Jwt-Assertion`.
- El JWT se verifica localmente con WebCrypto y JWKS de `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`.
- Se valida `alg=RS256`, `kid`, firma, `iss`, `aud`, `exp`, `nbf` y `email`.
- El JWKS sólo puede obtenerse de un subdominio `*.cloudflareaccess.com`; configuración hacia hosts arbitrarios se rechaza.
- Si existe `Cf-Access-Authenticated-User-Email`, debe coincidir con el email firmado del JWT.
- La identidad de base de datos se resuelve exclusivamente a partir del email verificado del JWT.
- Token inválido => 401 genérico.
- JWKS/configuración de Access no disponible => 503 genérico.
- Los detalles de validación sólo se registran server-side; no se devuelven al navegador.

## 2. Autorización

Lectura organizacional completa sólo para:

- `ADMIN`
- `HR`
- `AUDITOR`

Los roles `SUPERVISOR`, `COMMITTEE` y `OPERATOR` quedan sujetos a `user_groups` en los endpoints que les corresponden.

El frontend oculta secciones según rol, pero esto sólo es UX. La API siempre vuelve a autorizar.

## 3. Provisionamiento de roles

- `ADMIN` puede provisionar los roles soportados.
- `HR` sólo puede provisionar `SUPERVISOR`, `COMMITTEE`, `OPERATOR` y `EMPLOYEE`.
- `HR` no puede crear `ADMIN`, otro `HR` ni `AUDITOR`.
- Otros roles no provisionan usuarios.
- `EMPLOYEE` requiere un `employeeId` activo de la misma organización.
- `groupIds` se deduplican y se validan contra el scope del actor.
- El grupo del trabajador se agrega al usuario `EMPLOYEE` cuando corresponda.
- La creación de usuario queda auditada.

## 4. Scope y minimización de datos

- Listados de coberturas se filtran por `user_groups` para roles scoped.
- Listados de personal se filtran por `user_groups` para roles scoped.
- Email del trabajador se omite en listados/exportaciones para roles scoped.
- Detalle de cobertura ejecuta `assertGroupAccess`.
- Colas de rotación son read-only y exigen grupo autorizado.
- Auditoría de Supervisor/Committee resuelve entidad -> grupo antes de devolver eventos.
- Entidades de auditoría que no pueden resolverse de forma segura se deniegan para roles scoped.
- Exportación completa de auditoría sólo está disponible para ADMIN/HR/AUDITOR.

## 5. Intake / documentos

- El listado de borradores no devuelve `extracted_json`.
- ADMIN/HR pueden consultar borradores de su organización.
- SUPERVISOR/OPERATOR sólo pueden consultar, procesar y consumir borradores/attachments creados por ellos.
- El frontend no habilita consumo de un borrador hasta que el usuario abra explícitamente su extracción para revisión.
- El consumo vuelve a validar ownership y grupo en backend.
- Contenido extraído se muestra como texto/JSON escapado; nunca se inyecta como HTML.
- R2 usa segmentos de key sanitizados y conserva filename original sólo como metadata.

## 6. IA

- IA interpreta, extrae, explica y redacta; no decide rotación, elegibilidad, ranking, calificación ni adjudicación.
- El Dashboard nunca contiene API keys.
- `GET /v1/system/health` sólo expone IDs no secretos de proveedor/modelo.
- `POST /v1/system/ai-smoke-test` usa un prompt sintético fijo y no acepta contenido del usuario.
- El smoke test está bloqueado en producción y limitado a ADMIN/HR.
- Un fallo de proveedor devuelve 503 controlado sin mensaje interno.

## 7. Navegador

- Todo contenido dinámico insertado en plantillas HTML pasa por funciones de escape.
- JSON se muestra escapado.
- URLs de navegación externa sólo aceptan HTTPS; HTTP se permite únicamente para localhost en development.
- `javascript:`, `data:` y HTTP externo se rechazan.
- `VITE_EMPLOYEE_PORTAL_URL` debe configurarse explícitamente y validarse antes de redirigir.
- No se guardan tokens/API keys en `localStorage`, query params ni código frontend.
- Acciones críticas usan confirmación explícita y bloqueo anti-doble-submit.
- Producción incluye CSP estricta, `frame-ancestors 'none'`, no-referrer, nosniff, Permissions-Policy restrictiva y COOP same-origin.

## 8. Mutaciones / CSRF

- Navegadores con `Sec-Fetch-Site: cross-site` no pueden ejecutar métodos mutantes sobre `/v1/*`.
- GET/HEAD/OPTIONS siguen permitidos por esta guarda.
- Clientes server-side/CLI que no envían Fetch Metadata siguen sujetos a autenticación y RBAC.
- La topología objetivo del Control Center es same-origin; no diseñar producción alrededor de CORS abierto.

## 9. Exportaciones

- CSV escapa comas, comillas y saltos de línea.
- Valores que podrían iniciar fórmulas (`=`, `+`, `-`, `@`, incluso tras whitespace) se neutralizan antes de abrirse en Excel/Sheets.
- Respuestas CSV usan `private, no-store` y `nosniff`.

## 10. Manejo de errores

- Excepciones inesperadas no se devuelven textualmente al cliente.
- Sólo códigos públicos controlados en mayúsculas pueden llegar al navegador.
- Errores internos inesperados => `INTERNAL_ERROR` 500.
- Correlation ID se conserva para diagnóstico.

## 11. RAG e infraestructura

- `configured` significa sólo que se detecta configuración server-side; no significa healthy.
- RAG permanece deshabilitado hasta tener ACL, chunking, embeddings, retrieval, reranking y citas verificados.
- Supabase, Upstash, Modal, NVIDIA, Hugging Face, Ollama y Gmail no reciben estado healthy inventado.
- Secretos de esas integraciones nunca usan prefijo `VITE_`.

## 12. Propiedades que NO pueden relajarse al desplegar

1. No confiar en `Cf-Access-Authenticated-User-Email` sin verificar JWT.
2. No habilitar `x-yrak-user-email` fuera de development.
3. No abrir CORS global para solucionar problemas de despliegue.
4. No enviar secretos al navegador.
5. No convertir health `configured` en `healthy` sin test real.
6. No permitir que IA ejecute decisiones laborales.
7. No ampliar lectura de roles scoped a toda la organización.
8. No fusionar a `main` sin verificación completa.

## 13. Evidencia observada hasta ahora

Durante la construcción se ejecutó una verificación aislada del módulo `access-jwt.ts` con TypeScript 5.8.3 y opciones estrictas (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) sin errores. También se ejecutó una prueba criptográfica aislada en la que un JWT RS256 válido fue aceptado y un payload alterado fue rechazado por firma.

Estas pruebas son evidencia específica del verificador JWT. No sustituyen:

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

La rama no debe fusionarse hasta observar esos resultados y completar E2E con datos sintéticos y todos los roles.
