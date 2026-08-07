# Reglas de negocio confirmadas

## Coberturas cortas

Una cobertura cuya duración efectiva sea de **1 a 5 días inclusive** se resuelve por rotación. No requiere concurso, certificación ni examen de concurso. Se consideran personas activas del nivel inmediato inferior autorizado y disponibles para todo el periodo. Quien completa la cobertura consume su turno y pasa al final de la cola correspondiente.

## Coberturas largas

Una cobertura de **6 días o más** requiere validar requisitos configurados para el nivel destino. Sólo las personas elegibles participan en el examen de concurso. El ranking y desempate se calculan por reglas versionadas; la IA no interviene en el resultado.

## Nivel base y temporal

El trabajador conserva siempre `baseLevelId`. Una cobertura crea una `temporary_assignment` con `sourceLevelId`, `targetLevelId`, inicio y fin. Al cerrar, la asignación temporal termina; el nivel base permanece intacto.

## Ejemplo

Si una persona tiene nivel base 7 y cubre nivel 8, su registro queda:

- nivel base: 7
- asignación temporal: 8
- periodo: fechas del expediente
- al finalizar: vuelve operativamente a nivel 7

## Cascadas

El sistema soporta cadenas como 7→8, 6→7 y 5→6 sólo cuando cada transición esté autorizada y la política del grupo indique que el hueco generado requiere nueva cobertura.

## Auditoría

Debe conservarse: candidatos considerados, exclusiones con motivo, estado de fila antes/después, regla aplicada, aprobaciones, calificaciones y correcciones.
