# Reglas de negocio confirmadas

## Coberturas cortas
Una cobertura de **1 a 5 días inclusive** se resuelve por rotación. No requiere concurso, certificación ni examen de concurso. Se consideran personas activas del nivel inmediato inferior autorizado y disponibles para todo el periodo. Quien completa la cobertura consume su turno y pasa al final de la cola correspondiente.

## Coberturas largas
Una cobertura de **6 días o más** valida requisitos configurados para el nivel destino. Sólo las personas elegibles participan en examen. Ranking y desempate son deterministas y versionados; la IA no interviene.

## Nivel base y temporal
`baseLevelId` nunca se sustituye por la cobertura. Se crea una asignación temporal con nivel destino. Al cerrar, desaparece la asignación temporal y la persona vuelve operativamente a su nivel base.

## Cascada configurable
Una organización puede habilitar `cascadeEnabled`. Cuando está activa, aprobar 7→8 crea el expediente hijo para cubrir el hueco del nivel 7 mediante la transición 6→7; al aprobar ese expediente puede crearse 5→6, hasta `cascadeMaximumDepth`. Cada expediente hijo conserva sus propias reglas de rotación o concurso y requiere su propia validación/aprobación. No se inventan transiciones: todas deben existir en `level_transitions`.

## Concurrencia
La reserva se coordina por grupo con Durable Objects. Si el primer candidato ya está reservado por otro expediente simultáneo, el motor lo documenta y prueba con el siguiente disponible. D1 refleja `RESERVED`/`ASSIGNED` para operación y un reconciliador libera reservas D1 huérfanas.

## Auditoría
Se conserva candidatos considerados, exclusiones con motivo, cola antes/después, regla aplicada, aprobaciones, calificaciones, revisiones y conexiones MCP.
