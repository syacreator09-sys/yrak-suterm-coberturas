# Agentes runtime

`apps/agent-worker` implementa sesiones persistentes con Durable Objects siguiendo el patrón arquitectónico adoptado de Forja: una identidad por agente/sesión, memoria local mínima y herramientas explícitas.

## Agentes

- **intake**: convierte texto en borrador estructurado. No crea asignaciones.
- **audit**: lee `audit_events` y explica únicamente hechos persistidos.
- **communication**: consulta un expediente y redacta un borrador; nunca envía ni modifica el expediente.
- **support**: responde sobre reglas confirmadas y políticas persistidas.

## Seguridad

Todos requieren `AGENT_API_TOKEN` como secret y están fijados a `AGENT_ORGANIZATION_ID`.

El Worker de agentes no expone ninguna operación para:

- seleccionar candidato;
- cambiar una fila;
- cambiar una calificación;
- adjudicar un concurso;
- aprobar una cobertura;
- alterar el nivel base.

La API principal puede usar `IntakeAgent` durante el procesamiento documental, pero toda salida de IA queda como borrador pendiente de revisión humana.
