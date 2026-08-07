# Proveedores de IA

La IA está fuera del motor de decisión laboral. Ningún proveedor puede seleccionar candidatos, mover rotaciones, decidir elegibilidad, cambiar calificaciones, calcular el ranking oficial o adjudicar una cobertura.

## Arquitectura

YRAK usa dos niveles:

1. `AIProvider`: contrato común para `generate`, `extract` y `transcribe`.
2. `YrakAIRouter`: elige un proveedor por perfil/tarea y puede hacer fallback sólo ante errores técnicos reintentables.

Los agentes consumen tareas (`INTAKE_EXTRACTION`, `AUDIT_EXPLANATION`, `COMMUNICATION_DRAFT`, `SUPPORT_RESPONSE`) y no conocen el proveedor concreto.

## Workers AI

Es el proveedor cloud principal por defecto y utiliza el binding `AI`. Los modelos de texto/transcripción son configurables por entorno.

## OpenAI y Anthropic

Se conservan adaptadores nativos opcionales. Las API keys siempre se guardan como secrets, nunca en Git.

## Cualquier proveedor OpenAI-compatible

`OpenAICompatibleProvider` permite conectar sin crear una clase nueva cualquier servicio que implemente `POST /v1/chat/completions` con formato compatible.

Variables:

```text
AI_COMPAT_PROVIDER_ID=<nombre libre>
AI_COMPAT_BASE_URL=<base /v1>
AI_COMPAT_TEXT_MODEL=<modelo>
AI_COMPAT_API_KEY=<secret, sólo cuando sea necesario>
AI_COMPAT_TRANSCRIPTION_MODEL=<opcional>
```

Ejemplos de uso posibles: NVIDIA NIM, Ollama OpenAI-compatible, Groq, Together, OpenRouter, vLLM, LM Studio, llama.cpp u otros endpoints compatibles. Su inclusión aquí no implica aprobación comercial ni garantiza que todos soporten todas las capacidades; se debe revisar licencia, disponibilidad y contrato del proveedor concreto antes de producción.

### NVIDIA NIM para pruebas

```text
AI_PROVIDER=compatible
AI_COMPAT_PROVIDER_ID=nvidia-nim
AI_COMPAT_BASE_URL=https://integrate.api.nvidia.com/v1
AI_COMPAT_TEXT_MODEL=<modelo elegido para la prueba>
AI_COMPAT_API_KEY=<secret>
```

El modelo no se hardcodea para poder cambiarlo sin tocar código.

### Ollama local para pruebas

```text
AI_PROVIDER=compatible
AI_COMPAT_PROVIDER_ID=ollama-local
AI_COMPAT_BASE_URL=http://127.0.0.1:11434/v1
AI_COMPAT_TEXT_MODEL=qwen3:8b
```

Ollama local es una herramienta de desarrollo; no se debe publicar el puerto 11434 directamente a Internet.

## Routing de agentes

Perfiles iniciales:

- `local`: compatible primero, Workers AI como fallback si está disponible;
- `development`: compatible primero, Workers AI como fallback;
- `staging`: Workers AI primero, compatible como fallback;
- `production`: Workers AI primero, compatible sólo si fue configurado y aprobado;
- unit tests: `MockAIProvider`.

El router deduplica proveedores y limita intentos (`AI_MAX_PROVIDER_ATTEMPTS`, default 2). Sólo hace fallback por timeout/conexión, HTTP 429/5xx, respuesta vacía o salida estructurada inválida. Un resultado laboral desfavorable nunca es motivo de fallback.

## Telemetría

El router puede emitir eventos técnicos con proveedor, modelo, tarea, latencia, intento, éxito/fallo y código de error. No debe registrar por defecto prompts completos, archivos, datos personales ni secrets.

## Regla de seguridad

Cambiar de NVIDIA a Ollama, Workers AI, OpenAI, Anthropic o cualquier otro proveedor **no cambia ninguna regla de cobertura**. La IA interpreta/comunica; el motor determinista decide.
