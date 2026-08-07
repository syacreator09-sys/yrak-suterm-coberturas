# FINAL HANDOFF — sólo conexiones y ejecución

La rama autoritativa es `main`. `build/clean-v1` se conserva como snapshot de la construcción limpia que fue integrada mediante el PR #2. `build/end-to-end-v1` queda únicamente como histórico experimental y no debe fusionarse. El estado previo de `main` quedó preservado en `archive/main-before-clean-v1` y el estado previo al AI Router en `archive/main-before-ai-router`.

## A. Recursos Cloudflare

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
11. Cloudflare Access para panel/portal/API.

## B. Reemplazar placeholders

Buscar `REPLACE_WITH_` y sustituir únicamente con valores de infraestructura:

- D1 database ID;
- organization ID;
- remitente verificado;
- modelos/proveedores externos cuando se habiliten;
- dominios/rutas.

No cambiar reglas 1–5/6+ mediante placeholders.

## C. Secrets

Cargar con Wrangler, nunca Git:

- `BOOTSTRAP_TOKEN` (temporal; eliminar/desactivar después del bootstrap);
- `MCP_API_TOKEN`;
- `AGENT_API_TOKEN`;
- `OPENAI_API_KEY` sólo si se usa OpenAI;
- `ANTHROPIC_API_KEY` sólo si se usa Anthropic;
- `AI_COMPAT_API_KEY` sólo cuando el proveedor OpenAI-compatible lo requiera;
- credenciales S3 de R2 sólo en el entorno de backup cuando se usen.

## D. Primera ejecución

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

No interpretar este documento como evidencia de que esos comandos ya pasaron.

## E. Smoke test de cualquier proveedor de IA

YRAK incluye un adaptador OpenAI-compatible genérico. NVIDIA NIM, Ollama y otros proveedores compatibles son sólo configuraciones; no requieren cambiar agentes ni reglas laborales.

Configurar temporalmente:

```bash
export AI_COMPAT_PROVIDER_ID=nvidia-nim
export AI_COMPAT_BASE_URL=https://integrate.api.nvidia.com/v1
export AI_COMPAT_TEXT_MODEL='<modelo>'
export AI_COMPAT_API_KEY='<secret>'
pnpm smoke:ai
```

Para Ollama local, por ejemplo:

```bash
export AI_COMPAT_PROVIDER_ID=ollama-local
export AI_COMPAT_BASE_URL=http://127.0.0.1:11434/v1
export AI_COMPAT_TEXT_MODEL=qwen3:8b
unset AI_COMPAT_API_KEY
pnpm smoke:ai
```

El smoke test sólo verifica conectividad/modelo y devuelve metadata técnica (`ok`, proveedor, modelo, latencia, caracteres de respuesta). No toca D1, trabajadores, rotaciones, concursos ni asignaciones.

Después de confirmar un endpoint, revisar `docs/AI_PROVIDERS.md` y `docs/AI_ROUTER_TESTING_PLAN.md` para configurar routing/fallback del Agent Worker.

## F. Carga real

Orden obligatorio recomendado:

1. grupos/niveles/transiciones;
2. personal y nivel base;
3. requisitos;
4. mapeo requisito→nivel destino;
5. cumplimiento/vigencias;
6. usuarios/roles/grupos;
7. colas iniciales;
8. feriados/turnos;
9. políticas de grupo.

## G. Producción

Antes de producción:

- ejecutar `pnpm install`, `pnpm typecheck`, `pnpm test` y `pnpm build` sobre el monorepo completo;
- ejecutar `docs/TEST_MATRIX.md`;
- probar aislamiento de roles/grupos;
- probar 5 días y 6 días;
- probar concurso y segunda aprobación de nota;
- probar rechazo de rotación;
- probar dos solicitudes simultáneas;
- probar regreso a nivel base;
- probar documentos/audio/correo;
- probar cada proveedor de IA real con datos sintéticos antes de usar datos laborales;
- probar MCP/agentes como sólo lectura/no decisión;
- ejecutar backup D1 + R2;
- restaurar ambos en staging;
- comparar hashes/evidencia;
- revisar políticas oficiales pendientes en `DECISIONES_PENDIENTES.md`.

## H. Reglas que no deben cambiar al conectar infraestructura

- 1–5 días efectivos = rotación.
- 6+ días efectivos = requisitos + concurso.
- nivel base inmutable durante cobertura temporal.
- sólo transición explícitamente autorizada puede cubrir.
- IA no decide.
- cambiar de proveedor/modelo de IA no cambia ninguna decisión laboral.
- calificación corregida requiere segundo usuario.
- auditoría no se borra/modifica desde aplicación.

Las conexiones externas deben adaptarse a estas reglas; las reglas no deben alterarse para acomodar una integración.
