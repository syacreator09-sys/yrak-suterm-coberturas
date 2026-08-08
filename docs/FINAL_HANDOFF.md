# FINAL HANDOFF — conexiones, Control Center y ejecución

La rama autoritativa de producción continúa siendo `main`. `build/clean-v1` se conserva como snapshot de la construcción limpia integrada mediante PR #2. `build/end-to-end-v1` es histórico experimental y no debe fusionarse. `archive/main-before-clean-v1` y `archive/main-before-ai-router` preservan estados previos.

El nuevo YRAK Control Center se construye y revisa de forma aislada en `feature/control-center-v1`. **No fusionar esa rama a `main` hasta ejecutar y observar typecheck, tests, build y pruebas por rol.**

## A. Control Center

Documentación:

- `docs/CONTROL_CENTER.md`
- `docs/superpowers/specs/2026-08-07-yrak-control-center-design.md`
- `docs/superpowers/plans/2026-08-07-yrak-control-center-v1.md`
- `openapi/yrak-control-center-v1.yaml`

La implementación modular vive en `apps/admin-web`. La seguridad real permanece en `apps/api-worker`.

Antes de merge:

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
```

Después ejecutar D1/API local con datos sintéticos y comprobar ADMIN, HR, SUPERVISOR, COMMITTEE, OPERATOR, AUDITOR y EMPLOYEE. No interpretar la presencia del código como evidencia de que estos comandos ya pasaron.

## B. Recursos Cloudflare

Crear una sola vez:

1. D1 `yrak-suterm-coberturas`.
2. R2 `yrak-suterm-evidence`.
3. Queue `yrak-notifications`.
4. API Worker.
5. Durable Object `GroupCoordinator`.
6. Workflow `CoverageWorkflow`.
7. Maintenance Worker.
8. Agent Worker + Durable Object `YrakAgentSession` si se habilitan agentes.
9. MCP Worker si se conectará ChatGPT/Claude.
10. Email Service/Email Routing si se usará correo.
11. Cloudflare Access para Control Center, portal y API.

## C. Servicios externos previstos

Para pruebas/conexión del stack:

- Supabase — Postgres + pgvector para RAG;
- Upstash — Redis serverless cuando se requiera cache/estado efímero;
- Modal — compute/GPU pesado;
- NVIDIA NIM — proveedor OpenAI-compatible para pruebas/fallback;
- Hugging Face — registro/modelos cuando se use Modal;
- Ollama — pruebas locales;
- Gmail de pruebas — buzón dedicado para validar flujos de correo.

El Control Center muestra `configured/not configured` usando únicamente metadata server-side. No expone valores secretos. `configured` no equivale a `healthy`.

## D. Reemplazar placeholders

Buscar `REPLACE_WITH_` y sustituir únicamente con valores de infraestructura:

- D1 database ID;
- organization ID;
- remitente verificado;
- modelos/proveedores externos cuando se habiliten;
- dominios/rutas.

No cambiar reglas 1–5/6+ mediante placeholders.

## E. Secrets

Cargar mediante Wrangler/gestor del proveedor, nunca Git ni variables `VITE_*`:

- `BOOTSTRAP_TOKEN` (temporal; eliminar/desactivar después del bootstrap);
- `MCP_API_TOKEN`;
- `AGENT_API_TOKEN`;
- `OPENAI_API_KEY` sólo si se usa OpenAI;
- `ANTHROPIC_API_KEY` sólo si se usa Anthropic;
- `AI_COMPAT_API_KEY` sólo cuando el proveedor OpenAI-compatible lo requiera;
- `HUGGINGFACE_TOKEN` sólo si se requiere un modelo/token privado;
- credenciales de Supabase/Upstash/Modal/Gmail únicamente cuando existan adaptadores que las necesiten;
- credenciales S3 de R2 sólo en el entorno de backup cuando se usen.

El frontend sólo admite configuración pública documentada en `apps/admin-web/.env.example`.

## F. Primera ejecución

```bash
bash scripts/migrate-local.sh
bash scripts/verify-local.sh
```

Luego ejecutar API local, bootstrap, datos demo y:

```bash
API_BASE_URL=http://127.0.0.1:8787 \
YRAK_TEST_EMAIL=admin@example.com \
python3 scripts/e2e_api.py
```

Para el Control Center, mantener `VITE_API_BASE_URL` vacío en desarrollo para utilizar el proxy Vite existente hacia `127.0.0.1:8787`.

## G. Smoke test de cualquier proveedor de IA

YRAK incluye un adaptador OpenAI-compatible genérico. NVIDIA NIM, Ollama y otros proveedores compatibles son configuraciones, no agentes distintos.

CLI independiente:

```bash
export AI_COMPAT_PROVIDER_ID=nvidia-nim
export AI_COMPAT_BASE_URL=https://integrate.api.nvidia.com/v1
export AI_COMPAT_TEXT_MODEL='<modelo>'
export AI_COMPAT_API_KEY='<secret>'
pnpm smoke:ai
```

Ollama local:

```bash
export AI_COMPAT_PROVIDER_ID=ollama-local
export AI_COMPAT_BASE_URL=http://127.0.0.1:11434/v1
export AI_COMPAT_TEXT_MODEL=qwen3:8b
unset AI_COMPAT_API_KEY
pnpm smoke:ai
```

El Control Center añade `POST /v1/system/ai-smoke-test`, disponible únicamente para ADMIN/HR en development/staging. El prompt está fijado en backend, usa datos sintéticos, no toca D1 laboral y producción devuelve 403.

## H. Scope y seguridad agregados para el Control Center

- `/v1/reference/*` entrega catálogos read-only sin conceder permisos de `/v1/config/*`.
- listados de personal y coberturas se filtran por `user_groups` para roles scoped;
- el detalle de cobertura sigue ejecutando `assertGroupAccess`;
- colas de rotación read-only requieren grupo autorizado;
- auditoría para Supervisor/Committee resuelve el grupo de la entidad antes de responder;
- tipos de entidad de auditoría no resolubles se deniegan para roles scoped;
- exportaciones de personal/coberturas respetan grupos autorizados;
- auditoría CSV completa sólo ADMIN/HR/AUDITOR;
- health/integrations no devuelve secretos;
- IA sintética queda bloqueada en producción;
- `EMPLOYEE` se redirige fuera de `admin-web` al portal del trabajador.

## I. Carga real

Orden recomendado:

1. grupos/niveles/transiciones;
2. personal y nivel base;
3. requisitos;
4. mapeo requisito→nivel destino;
5. cumplimiento/vigencias;
6. usuarios/roles/grupos;
7. colas iniciales;
8. feriados/turnos;
9. políticas de grupo.

## J. Producción

Antes de producción:

- ejecutar todos los comandos de verificación del monorepo;
- ejecutar `docs/TEST_MATRIX.md`;
- probar aislamiento de roles/grupos desde API y navegador;
- probar 5 días y 6 días;
- probar concurso y segunda aprobación de nota;
- probar rechazo/cancelación de rotación;
- probar dos solicitudes simultáneas;
- probar regreso a nivel base;
- probar documentos/audio/correo;
- probar cada proveedor de IA real con datos sintéticos antes de datos laborales;
- probar RAG con ACL y citas antes de habilitar su consulta en el Dashboard;
- probar MCP/agentes como lectura/no decisión;
- ejecutar backup D1 + R2;
- restaurar ambos en staging;
- comparar hashes/evidencia;
- revisar políticas oficiales pendientes en `DECISIONES_PENDIENTES.md`.

## K. Reglas que no deben cambiar al conectar infraestructura

- 1–5 días efectivos = rotación.
- 6+ días efectivos = requisitos + concurso.
- nivel base inmutable durante cobertura temporal.
- sólo transición explícitamente autorizada puede cubrir.
- IA no decide.
- cambiar de proveedor/modelo de IA no cambia decisiones laborales.
- calificación corregida requiere segundo usuario.
- auditoría no se borra/modifica desde aplicación.

Las conexiones externas deben adaptarse a estas reglas; las reglas no se alteran para acomodar una integración.
