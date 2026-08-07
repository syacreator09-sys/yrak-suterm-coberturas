# FINAL HANDOFF — sólo conexiones y ejecución

La rama autoritativa es `build/clean-v1`. El PR asociado debe permanecer Draft hasta ejecutar validación.

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
- modelos externos si se eligen OpenAI/Anthropic;
- dominios/rutas.

No cambiar reglas 1–5/6+ mediante placeholders.

## C. Secrets

Cargar con Wrangler, nunca Git:

- `BOOTSTRAP_TOKEN` (temporal; eliminar/desactivar después del bootstrap);
- `MCP_API_TOKEN`;
- `AGENT_API_TOKEN`;
- `OPENAI_API_KEY` sólo si se usa OpenAI;
- `ANTHROPIC_API_KEY` sólo si se usa Anthropic;
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

## E. Carga real

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

## F. Producción

Antes de producción:

- ejecutar `docs/TEST_MATRIX.md`;
- probar aislamiento de roles/grupos;
- probar 5 días y 6 días;
- probar concurso y segunda aprobación de nota;
- probar rechazo de rotación;
- probar dos solicitudes simultáneas;
- probar regreso a nivel base;
- probar documentos/audio/correo;
- probar MCP/agentes como sólo lectura/no decisión;
- ejecutar backup D1 + R2;
- restaurar ambos en staging;
- comparar hashes/evidencia;
- revisar políticas oficiales pendientes en `DECISIONES_PENDIENTES.md`.

## G. Reglas que no deben cambiar al conectar infraestructura

- 1–5 días efectivos = rotación.
- 6+ días efectivos = requisitos + concurso.
- nivel base inmutable durante cobertura temporal.
- sólo transición explícitamente autorizada puede cubrir.
- IA no decide.
- calificación corregida requiere segundo usuario.
- auditoría no se borra/modifica desde aplicación.

Las conexiones externas deben adaptarse a estas reglas; las reglas no deben alterarse para acomodar una integración.
