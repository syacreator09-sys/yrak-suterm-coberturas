# YRAK Control Center

## Propósito

`apps/admin-web` es el panel operativo para administración, RH, supervisión, comité, operación y auditoría. No contiene ni reimplementa reglas laborales: consume la API y muestra sus resultados.

`EMPLOYEE` no usa el Control Center; la aplicación redirige al `employee-portal`.

## Navegación por rol

- `ADMIN`: todas las secciones.
- `HR`: operación, personal, requisitos, documentos, RAG, IA, auditoría, reportes y configuración.
- `SUPERVISOR`: overview, coberturas, rotaciones, concursos, personal, requisitos, documentos, auditoría y reportes dentro de grupos autorizados.
- `COMMITTEE`: overview, coberturas, concursos, personal, requisitos, auditoría y reportes dentro de grupos autorizados.
- `OPERATOR`: overview, coberturas, rotaciones, concursos y documentos dentro de grupos autorizados.
- `AUDITOR`: overview, coberturas, rotaciones, concursos, personal, requisitos, RAG, IA, infraestructura, auditoría y reportes; sin mutaciones operativas desde la UI.
- `EMPLOYEE`: redirección al portal del trabajador.

La matriz del navegador sirve para experiencia de usuario. La autorización efectiva sigue en `apps/api-worker`.

## Seguridad aplicada

- autenticación mediante `/v1/me`;
- Cloudflare Access esperado en staging/producción;
- `x-yrak-user-email` aceptado por el backend sólo cuando `APP_ENV=development`;
- datos dinámicos escapados antes de insertarse en HTML;
- ninguna API key o token se lee desde query params/localStorage;
- valores `VITE_*` son únicamente configuración pública del navegador;
- acciones críticas usan confirmación explícita y botón bloqueado mientras la petición está en curso;
- creación de cobertura conserva `idempotency-key`;
- listados de personal, coberturas y reportes respetan `user_groups` para roles con scope;
- auditoría para Supervisor/Committee resuelve y valida el grupo de la entidad antes de devolver eventos;
- auditoría completa CSV queda limitada a ADMIN/HR/AUDITOR;
- integración/health devuelve sólo booleanos y metadatos no secretos.

## Desarrollo local

Crear `apps/admin-web/.env` a partir de `.env.example` y mantener `VITE_API_BASE_URL` vacío para usar el proxy Vite existente.

```bash
pnpm install
pnpm --filter @yrak/api-worker dev
pnpm --filter @yrak/admin-web dev
```

El Vite dev server proxifica `/v1`, `/bootstrap`, `/health` y `/ready` hacia `http://127.0.0.1:8787`.

## Verificación obligatoria antes de merge

```bash
pnpm --filter @yrak/admin-web typecheck
pnpm --filter @yrak/admin-web test
pnpm --filter @yrak/admin-web build

pnpm --filter @yrak/api-worker typecheck
pnpm --filter @yrak/api-worker test
pnpm --filter @yrak/api-worker build

pnpm typecheck
pnpm test
pnpm build
```

Después ejecutar API/D1 local con datos sintéticos y verificar los siete roles. No considerar el Control Center validado únicamente porque el código está presente en Git.

## Secciones

### Overview

KPIs derivados de endpoints operativos visibles para el rol. Una fuente que responda 403/404 se muestra como no disponible y no se inventa un valor.

### Coberturas

Preview, creación, lectura de expediente, selección de rotación, aprobación de rotación, cierre y cancelación según rol. La API decide qué acción es válida.

### Rotaciones 1–5

Vista read-only de pools y colas mediante `/v1/reference/*`. Nunca mueve posiciones desde el navegador.

### Concursos 6+

Evaluación, configuración, captura de calificación, control dual de revisión, ranking y adjudicación. El ranking/adjudicación se calculan y validan en backend.

### Personal / Requisitos

Directorio scoped, alta permitida sólo para ADMIN/HR, indisponibilidad según rol y catálogo de requisitos read-only.

### Documentos

Carga de evidencia, extracción y borradores de intake. El resultado IA permanece `PENDING_REVIEW` hasta consumo humano explícito.

### RAG

Por ahora es una superficie veraz de readiness. No declara Supabase/pgvector, chunking, embeddings o retrieval como funcionando hasta que exista el pipeline y sus pruebas.

### IA y agentes

Muestra límites de Intake/Audit/Communication/Support. `POST /v1/system/ai-smoke-test` usa un prompt sintético fijo, no acepta texto del usuario y está bloqueado en producción.

### Infraestructura

Vista consolidada de configuración detectada para Cloudflare, Supabase, Upstash, Modal, NVIDIA, Hugging Face, Ollama y Gmail de pruebas. `configured` no significa `healthy`.

### Auditoría

Sólo lectura. Para roles scoped, la API exige que la entidad corresponda a un grupo autorizado.

### Reportes

CSV generado por backend. Personal/coberturas se filtran por grupos cuando el rol está limitado; auditoría completa sólo ADMIN/HR/AUDITOR.

## Contrato API adicional

Los endpoints del Control Center están documentados en:

`openapi/yrak-control-center-v1.yaml`

El contrato principal existente sigue en:

`openapi/yrak-api.yaml`

Antes de una release pública se deben consolidar ambos en un único contrato OpenAPI versionado.
