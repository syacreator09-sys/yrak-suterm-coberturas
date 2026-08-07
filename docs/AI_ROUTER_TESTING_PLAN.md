# AI Router de pruebas — NVIDIA NIM + Ollama + Workers AI

## Objetivo

Agregar una capa de proveedores intercambiables para **pruebas, desarrollo, staging y fallback de funciones de IA** sin modificar ni influir en el motor laboral determinista de YRAK.

La IA continúa limitada a:
- transcripción;
- extracción estructurada;
- redacción;
- explicación de auditoría;
- soporte.

La IA **NO** puede:
- seleccionar candidatos;
- mover la cola de rotación;
- determinar elegibilidad laboral;
- calcular o alterar rankings oficiales;
- cambiar calificaciones;
- aprobar o adjudicar coberturas.

## Estado actual

`packages/ai-provider` ya expone `AIProvider` con tres operaciones:

```ts
interface AIProvider {
  transcribe(input: { bytes: ArrayBuffer; mimeType: string; language?: string }): Promise<{ text: string; confidence?: number }>;
  extract<T>(input: { system: string; content: string }, schema: z.ZodType<T>): Promise<T>;
  generate(input: { system: string; prompt: string }): Promise<string>;
}
```

Ya existen proveedores Mock, Workers AI, OpenAI y Anthropic. Esta ampliación añade NVIDIA NIM y Ollama, más un router de políticas.

## Proveedores

| ID | Uso | Red | Recomendación |
|---|---|---|---|
| `mock` | tests unitarios reproducibles | ninguna | obligatorio |
| `ollama` | pruebas locales/offline | LAN/local | opcional |
| `workers-ai` | Cloudflare/staging/producción | Cloudflare | principal cloud |
| `nvidia-nim` | pruebas gratuitas, comparación y fallback | Internet | principal experimental |
| `openai` | comparación/casos específicos | Internet | opcional |
| `anthropic` | comparación/casos específicos | Internet | opcional |

Los nombres concretos de modelos NO se codifican en el dominio. Deben configurarse por entorno para permitir cambiar modelos sin modificar agentes ni reglas.

## Archivos a agregar

```text
packages/ai-provider/src/
├── provider.ts                 # existente
├── ai-router.ts                # nuevo
├── routing-policy.ts           # nuevo
├── provider-registry.ts        # nuevo
├── nvidia-nim-provider.ts      # nuevo
├── ollama-provider.ts          # nuevo
├── workers-ai-provider.ts      # existente
├── openai-provider.ts          # existente
├── anthropic-provider.ts       # existente
├── mock-provider.ts            # existente
└── index.ts                    # exportar nuevos módulos

packages/ai-provider/src/__tests__/
├── ai-router.test.ts
├── nvidia-nim-provider.test.ts
├── ollama-provider.test.ts
└── routing-policy.test.ts
```

No crear un nuevo agente por cada proveedor. Los agentes existentes consumen el mismo `AIProvider`/`AIRouter`.

## Tipos de tarea

```ts
export type AITask =
  | 'INTAKE_EXTRACTION'
  | 'AUDIT_EXPLANATION'
  | 'COMMUNICATION_DRAFT'
  | 'SUPPORT_RESPONSE'
  | 'TRANSCRIPTION'
  | 'VISION_EXTRACTION';

export type AIProviderId =
  | 'mock'
  | 'ollama'
  | 'workers-ai'
  | 'nvidia-nim'
  | 'openai'
  | 'anthropic';
```

## Perfiles de ejecución

### `test`

```text
Todas las tareas -> MockProvider
```

Nunca hacer llamadas de red durante unit tests.

### `local`

```text
texto/extracción -> Ollama
transcripción -> Mock o Workers AI si explícitamente se habilita red
fallback -> Mock controlado para fixtures, nunca para producción
```

Ollama es opcional. Si no está disponible, el arranque del sistema no debe fallar; sólo se marca el proveedor como no saludable.

### `development`

```text
INTAKE_EXTRACTION      -> NVIDIA NIM -> Workers AI
AUDIT_EXPLANATION      -> NVIDIA NIM -> Workers AI
COMMUNICATION_DRAFT    -> NVIDIA NIM -> Workers AI
SUPPORT_RESPONSE       -> NVIDIA NIM -> Workers AI
TRANSCRIPTION          -> Workers AI
VISION_EXTRACTION      -> Workers AI -> NVIDIA NIM si el modelo configurado soporta visión
```

Este perfil está pensado para aprovechar endpoints gratuitos/de desarrollo de NVIDIA cuando existan.

### `staging`

```text
principal -> Workers AI
fallback  -> NVIDIA NIM
shadow    -> opcionalmente ejecutar NVIDIA NIM en paralelo sin usar su respuesta
```

El modo shadow sólo sirve para medir calidad/latencia; nunca debe duplicar acciones de negocio.

### `production`

```text
principal -> Workers AI
fallback  -> NVIDIA NIM (si licencia/condiciones permiten el uso previsto)
OpenAI/Anthropic -> sólo si se habilitan explícitamente por política
```

No asumir que un endpoint gratuito de NVIDIA está autorizado para producción. La licencia/uso de cada modelo debe verificarse antes de activarlo.

## Política de fallback

Un fallback puede ocurrir sólo por errores técnicos/IA:
- timeout;
- conexión;
- HTTP 429;
- HTTP 5xx;
- proveedor no configurado;
- respuesta vacía;
- JSON inválido o fallo de validación Zod, si la tarea permite reintento con otro modelo.

No hacer fallback por:
- una regla laboral que no gusta al usuario;
- candidato no elegible;
- ranking oficial;
- ausencia de autorización humana.

Máximo recomendado: 2 proveedores por solicitud. Sin loops.

## Timeouts y circuit breaker

Valores iniciales configurables:

```text
AI_REQUEST_TIMEOUT_MS=30000
AI_MAX_PROVIDER_ATTEMPTS=2
AI_CIRCUIT_FAILURE_THRESHOLD=5
AI_CIRCUIT_COOLDOWN_SECONDS=60
```

El router registra salud de cada proveedor y evita insistir contra un endpoint repetidamente caído.

## NVIDIA NIM Provider

Debe implementar el `AIProvider` existente usando un endpoint OpenAI-compatible configurable.

Variables:

```text
NVIDIA_API_KEY=
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_TEXT_MODEL=
NVIDIA_VISION_MODEL=
```

Reglas:
- nunca hardcodear la API key;
- `Authorization: Bearer ...`;
- `generate()` usa chat completions compatible;
- `extract()` llama `generate()` y valida con Zod;
- `transcribe()` lanza `AIProviderOperationUnsupportedError` salvo que se configure explícitamente un endpoint de audio compatible;
- modelo configurable por entorno;
- manejar 429/5xx/timeout como errores clasificables para fallback.

## Ollama Provider

Variables:

```text
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_TEXT_MODEL=qwen3:8b
```

Debe usar la API HTTP de Ollama sin SDK obligatorio.

Reglas:
- sólo se habilita si `OLLAMA_BASE_URL` y `OLLAMA_TEXT_MODEL` están configurados;
- timeout corto de health check;
- `generate()` y `extract()`;
- `transcribe()` unsupported por defecto;
- nunca exponer Ollama públicamente para que Cloudflare lo llame directamente desde Internet;
- si en el futuro se necesita acceso remoto, usar túnel/servicio autenticado específico, no puerto 11434 abierto.

## AI Router

Interfaz sugerida:

```ts
export interface AIRouter {
  generate(task: AITask, input: { system: string; prompt: string }): Promise<AIRoutedResult<string>>;
  extract<T>(task: AITask, input: { system: string; content: string }, schema: z.ZodType<T>): Promise<AIRoutedResult<T>>;
  transcribe(task: 'TRANSCRIPTION', input: { bytes: ArrayBuffer; mimeType: string; language?: string }): Promise<AIRoutedResult<{ text: string; confidence?: number }>>;
}

export interface AIRoutedResult<T> {
  value: T;
  provider: AIProviderId;
  model?: string;
  attempts: number;
  fallbackUsed: boolean;
  latencyMs: number;
}
```

El router no expone métodos relacionados con rotaciones, concursos, notas o adjudicación.

## Registro/telemetría

Crear eventos de inferencia sin guardar por defecto el contenido sensible:

```ts
interface AIInferenceEvent {
  task: AITask;
  provider: AIProviderId;
  model?: string;
  success: boolean;
  fallbackUsed: boolean;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  errorCode?: string;
  createdAt: string;
}
```

Por defecto NO registrar:
- prompt completo;
- audio;
- PDF;
- nombres de trabajadores;
- datos personales;
- tokens/API keys.

Para debugging debe existir un flag explícito y seguir aplicando redacción de datos sensibles.

## Shadow evaluation

Modo opcional de pruebas:

```text
respuesta principal: Workers AI
respuesta shadow: NVIDIA NIM
```

Guardar sólo métricas y, cuando exista dataset sintético, score de evaluación. La respuesta shadow jamás produce efectos.

## Dataset de pruebas

Usar datos sintéticos, no trabajadores reales, para comparar:
- extracción correcta de fechas;
- identificación de grupo/nivel;
- clasificación de documento;
- JSON válido;
- explicación de auditoría;
- calidad de redacción;
- latencia;
- porcentaje de fallback.

## Pruebas obligatorias antes de merge

1. RED/GREEN: router elige `mock` en perfil test.
2. Router usa NVIDIA primero en perfil development para tareas configuradas.
3. 429 de NVIDIA produce fallback a Workers AI.
4. Timeout produce máximo un fallback y no un loop.
5. JSON inválido de proveedor A puede reintentarse con B y debe terminar validado por Zod.
6. `TRANSCRIPTION` no se envía a Ollama/NVIDIA si no tienen capability.
7. Si todos fallan, se devuelve un error tipado y el expediente permanece `PENDING_AI`/borrador, nunca se crea una asignación.
8. Ningún tipo o método del AI Router permite `chooseWinner`, `moveQueue`, `changeScore`, `approve` o `assign`.
9. Telemetría no incluye secrets ni prompt completo por defecto.
10. Ollama caído no impide que el Worker/API principal arranque.
11. Modelo configurable por env, sin IDs obligatorios hardcodeados.
12. Tests unitarios no hacen llamadas reales de red.

## Variables de entorno nuevas

```text
AI_PROFILE=test|local|development|staging|production
AI_REQUEST_TIMEOUT_MS=30000
AI_MAX_PROVIDER_ATTEMPTS=2

NVIDIA_API_KEY=
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_TEXT_MODEL=
NVIDIA_VISION_MODEL=

OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_TEXT_MODEL=qwen3:8b

AI_GATEWAY_URL=
AI_GATEWAY_TOKEN=
```

No es obligatorio usar AI Gateway para desarrollo local. Puede activarse después para staging/producción.

## Orden de implementación

1. Tests de `routing-policy`.
2. `ProviderRegistry` y capabilities.
3. `NvidiaNimProvider` con tests HTTP simulados.
4. `OllamaProvider` con tests HTTP simulados.
5. `AIRouter` con tests de fallback.
6. Integrar el Agent Worker para resolver provider por `AI_PROFILE`.
7. Agregar telemetría sin PII.
8. Agregar `.dev.vars.example` sin secretos.
9. Ejecutar typecheck/tests/build.
10. Sólo entonces probar NVIDIA API real y Ollama real.
11. Después probar Workers AI/AI Gateway en staging.

## Criterio de aceptación

Esta ampliación está lista cuando cambiar entre Mock, Ollama, Workers AI y NVIDIA NIM no requiere modificar los agentes ni los motores de negocio, los fallos de IA nunca causan una decisión laboral automática y todos los tests de routing/fallback pasan localmente.
