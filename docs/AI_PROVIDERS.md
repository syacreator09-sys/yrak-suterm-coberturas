# Proveedores de IA

La IA está fuera del motor de decisión. El `AIProvider` sólo implementa transcripción, extracción estructurada y generación de texto.

## Workers AI

Es la configuración inicial. Requiere binding `AI`. Para audio se usa por defecto `@cf/openai/whisper-large-v3-turbo`; para texto el modelo se define con `WORKERS_AI_TEXT_MODEL`. Cloudflare permite invocar modelos mediante `env.AI.run()` y convertir PDF/imágenes con `env.AI.toMarkdown()`.

## OpenAI

Fijar `AI_PROVIDER=openai` y almacenar `OPENAI_API_KEY` como secret. El adaptador usa Responses API para texto/extracción y Audio Transcriptions para audio. Los modelos son configurables; los valores iniciales son `gpt-5.6-luna` y `gpt-4o-transcribe`.

## Anthropic

Fijar `AI_PROVIDER=anthropic` y guardar `ANTHROPIC_API_KEY` como secret. El adaptador usa Messages API. Anthropic no se usa aquí para transcripción; si se necesitan audios con Claude como modelo de extracción, primero se transcribe mediante Workers AI/OpenAI y luego se envía el texto.

Nunca coloque API keys en Git o `wrangler.jsonc`.
