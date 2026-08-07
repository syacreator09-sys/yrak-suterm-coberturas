# Arquitectura

```text
Admin / Portal / Email / Audio / MCP
              |
         API Worker (Hono)
              |
  --------------------------------
  | dominio determinista          |
  | calendario                    |
  | rotación                      |
  | elegibilidad                  |
  | concurso                      |
  | asignaciones                  |
  --------------------------------
       |        |        |
      D1       R2     Durable Object
       |                 |
    Auditoría         locks/colas
       |
   Workflows / Queues / Email
```

D1 es la fuente de verdad del estado persistente. Durable Objects coordinan concurrencia, pero no reemplazan el historial auditable. Workflows orquestan esperas y procesos largos. R2 guarda originales y evidencias. Los agentes consumen servicios read-only o crean borradores sujetos a revisión.
