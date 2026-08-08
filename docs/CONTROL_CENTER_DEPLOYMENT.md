# YRAK Control Center — Deployment Topology

Estado: diseño de despliegue; no ejecutar producción antes de completar `docs/CONTROL_CENTER_VERIFICATION.md`.

## Topología recomendada

Mantener frontend y API bajo el mismo origen público:

```text
https://<control-host>/
  ├── /                 -> admin-web estático
  ├── /assets/*         -> assets Vite
  ├── /v1/*             -> api-worker
  ├── /health           -> health mínimo del api-worker si se enruta ahí
  └── /ready            -> readiness mínimo del api-worker si se enruta ahí
```

El dominio real se define al conectar Cloudflare. No hardcodearlo en el repositorio.

Ventajas:

- no requiere CORS abierto;
- el navegador usa `VITE_API_BASE_URL=` vacío;
- Fetch Metadata/CSRF guard puede exigir same-origin/same-site;
- Cloudflare Access protege una superficie coherente;
- cookies/sesión de Access y rutas del API permanecen bajo el mismo límite operativo.

## Cloudflare Access

Crear una aplicación Access para el host del Control Center/API y usar políticas explícitas de usuarios/grupos autorizados.

Configurar en el API Worker:

```text
APP_ENV=staging|production
ACCESS_TEAM_DOMAIN=<team>.cloudflareaccess.com
ACCESS_AUD=<aud-tag-de-la-aplicacion>
```

El API Worker no confía en el email header como credencial. Verifica `Cf-Access-Jwt-Assertion` contra JWKS y valida issuer/audience/exp/nbf/email.

El frontend estático también debe quedar detrás de Access. Que el código JavaScript no contenga secretos no significa que el panel deba exponerse públicamente.

## Development local

El único bypass de identidad permitido es:

```text
APP_ENV=development
request host=localhost|127.0.0.1|IPv6 loopback
x-yrak-user-email=<usuario sintético provisionado>
```

Un Worker remoto, incluso mal marcado como `development`, debe exigir Access JWT. Validar esta propiedad con:

```bash
API_BASE_URL=https://<staging-host> \
CONFIRM_ACCESS_STAGING_TEST=YES \
node scripts/access-auth-smoke.mjs
```

## Staging antes de production

Orden obligatorio:

1. desplegar D1/R2/Queue/Workflow/API en staging;
2. aplicar Access al host staging;
3. configurar `ACCESS_TEAM_DOMAIN` y `ACCESS_AUD`;
4. ejecutar el smoke anti-header-spoof;
5. ejecutar matriz read-only de roles con identidades staging autorizadas;
6. desplegar `admin-web`;
7. revisar CSP/headers en navegador;
8. ejecutar E2E con datos sintéticos;
9. probar rollback;
10. sólo después preparar production.

## Employee Portal

No se asume `/employee/` ni otro path fijo. `VITE_EMPLOYEE_PORTAL_URL` debe configurarse con la URL pública real del entorno y el navegador la valida antes de redirigir.

El employee portal debe tener su propia política de Access o compartir una política apropiada del mismo host, pero siempre manteniendo RBAC del API. La redirección del navegador no sustituye autorización.

## Headers del frontend

`apps/admin-web/public/_headers` contiene el baseline:

- CSP same-origin;
- `frame-ancestors 'none'`;
- Referrer-Policy no-referrer;
- X-Content-Type-Options nosniff;
- X-Frame-Options DENY;
- Permissions-Policy restrictiva;
- COOP same-origin.

Si el servicio de hosting no consume `_headers`, reproducir los mismos headers en Cloudflare antes de producción; no eliminarlos para solucionar un error de despliegue.

## CORS

No añadir `Access-Control-Allow-Origin: *` al API.

Si en el futuro existe una necesidad real de separar host frontend/API, diseñar explícitamente:

- allowlist exacta de origin;
- credenciales;
- preflight;
- CSRF/origin validation;
- CSP `connect-src` exacto;
- pruebas E2E.

Eso sería un cambio de arquitectura y debe revisarse antes de implementarlo.

## Secrets

Nunca desplegar secretos como `VITE_*`.

Server-side únicamente:

- BOOTSTRAP_TOKEN;
- MCP_API_TOKEN;
- AGENT_API_TOKEN;
- AI provider keys;
- Hugging Face token;
- futuras credenciales Supabase/Upstash/Modal/Gmail cuando existan adaptadores que las necesiten.

`ACCESS_TEAM_DOMAIN` y `ACCESS_AUD` no son secretos, pero deben coincidir con la aplicación Access correcta.

## Production gate

Antes de producción deben existir resultados observados para:

- `scripts/verify-control-center.sh`;
- migración/verify D1;
- role matrix;
- scope A/B;
- intake ownership/review;
- rotación 1–5;
- concurso 6+;
- Access staging;
- navegador/CSP;
- exportaciones CSV;
- IA sintética;
- backup/restore.

No promover una rama sólo porque el build compile.
