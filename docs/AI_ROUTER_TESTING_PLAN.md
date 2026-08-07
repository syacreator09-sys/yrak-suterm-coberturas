# AI Router de pruebas — arquitectura agnóstica de proveedor

## Objetivo

Permitir probar, comparar y sustituir proveedores de IA sin modificar agentes ni reglas laborales. NVIDIA NIM y Ollama son sólo configuraciones de ejemplo; la arquitectura no depende de ellos.

## Principio

```text
Agentes YRAK
   ↓
TaskScopedAIProvider
   ↓
YrakAIRouter
   ↓
AIProviderRegistry
   ├── Workers AI
   ├── OpenAI
   ├── Anthropic
   └── OpenAICompatibleProvider
          ├── NVIDIA NIM
          ├── Ollama
          ├── Groq
          ├── Together
          ├── OpenRouter
          ├── vLLM
          ├── LM Studio
          ├── llama.cpp
          └── cualquier endpoint compatible
```

No se crea un agente por proveedor.

## Contrato existente

`AIProvider` conserva sólo:

- `generate()`;
- `extract()`;
- `transcribe()`.

El router no expone ninguna operación laboral.

## Tareas

- `INTAKE_EXTRACTION`
- `AUDIT_EXPLANATION`
- `COMMUNICATION_DRAFT`
- `SUPPORT_RESPONSE`
- `TRANSCRIPTION`
- `VISION_EXTRACTION`

## Perfiles

- `test`: Mock.
- `local`: proveedor compatible primero; Workers AI fallback cuando esté disponible.
- `development`: proveedor compatible primero; Workers AI fallback.
- `staging`: Workers AI primero; proveedor compatible fallback.
- `production`: Workers AI primero; compatible sólo si está configurado/aprobado.

## Proveedor compatible

Variables comunes:

```text
AI_COMPAT_PROVIDER_ID=<nombre libre>
AI_COMPAT_BASE_URL=<endpoint /v1>
AI_COMPAT_TEXT_MODEL=<modelo>
AI_COMPAT_API_KEY=<secret opcional>
AI_COMPAT_TRANSCRIPTION_MODEL=<opcional>
AI_REQUEST_TIMEOUT_MS=30000
```

El código usa `/chat/completions`. Si se configura un modelo de transcripción, usa `/audio/transcriptions`; de lo contrario declara esa capacidad como no disponible.

### NVIDIA NIM de prueba

```text
AI_COMPAT_PROVIDER_ID=nvidia-nim
AI_COMPAT_BASE_URL=https://integrate.api.nvidia.com/v1
AI_COMPAT_TEXT_MODEL=<modelo>
AI_COMPAT_API_KEY=<secret>
```

### Ollama local de prueba

```text
AI_COMPAT_PROVIDER_ID=ollama-local
AI_COMPAT_BASE_URL=http://127.0.0.1:11434/v1
AI_COMPAT_TEXT_MODEL=qwen3:8b
```

No exponer el puerto de Ollama directamente a Internet.

## Fallback

Máximo recomendado: 2 proveedores por solicitud (`AI_MAX_PROVIDER_ATTEMPTS=2`).

Se permite fallback sólo ante errores técnicos reintentables:

- conexión/timeout;
- HTTP 429;
- HTTP 5xx;
- respuesta vacía;
- JSON/Zod inválido en extracción.

No se permite fallback para intentar cambiar:

- elegibilidad;
- rotación;
- ranking;
- calificación;
- aprobación;
- adjudicación.

## Telemetría

`YrakAIRouter` puede emitir `AIInferenceEvent` con:

- perfil;
- tarea;
- proveedor;
- modelo;
- intento;
- éxito/fallo;
- fallback;
- latencia;
- código de error.

No registra por defecto prompts, archivos, nombres, datos personales ni secrets.

## Pruebas

Se escribieron pruebas de contrato para:

1. fallback por 429/5xx;
2. deduplicación y límite de intentos;
3. no fallback en error 400;
4. endpoint compatible sin API key para local;
5. Bearer token cuando existe key;
6. exposición de status HTTP para clasificación.

Antes de producción todavía deben ejecutarse en el repositorio completo:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Después se prueban endpoints reales usando datos sintéticos.

## Restricción de seguridad

La IA sólo interpreta y comunica. Rotación, elegibilidad, concursos, ranking, notas y adjudicación continúan en motores deterministas y aprobación humana.
