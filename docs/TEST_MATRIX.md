# Matriz de pruebas de aceptación

Estas pruebas están **diseñadas y/o codificadas**, pero no se consideran ejecutadas hasta correrlas localmente/staging.

| ID | Caso | Resultado esperado |
|---|---|---|
| BR-01 | 1 día efectivo | ROTATION |
| BR-02 | 5 días efectivos | ROTATION |
| BR-03 | 6 días efectivos | COMPETITION |
| BR-04 | 14 días efectivos | COMPETITION |
| ROT-01 | primero de fila disponible | se propone primero |
| ROT-02 | primero no disponible | se documenta salto y se propone siguiente |
| ROT-03 | primero reservado simultáneamente | Durable Object bloquea y se propone siguiente |
| ROT-04 | cobertura completada | trabajador vuelve a nivel base y pasa al final |
| ROT-05 | cancelación antes de iniciar | fila preservada |
| ROT-06 | rechazo antes de aprobación | se aplica `rejectionConsumesTurn` y se conserva evento |
| ROT-07 | mismo candidato rechazó el caso | no vuelve a proponerse en ese expediente |
| LVL-01 | nivel 7 cubre 8 | baseLevel permanece 7, targetLevel temporal 8 |
| LVL-02 | transición no configurada | asignación rechazada |
| CAS-01 | cascada desactivada | no se crea hijo |
| CAS-02 | cascada 7→8 con 6→7 configurado | se crea hijo target 7 |
| CAS-03 | cascada llega a nivel sin transición inferior | cadena termina |
| ELG-01 | falta requisito obligatorio | INELIGIBLE con motivo |
| ELG-02 | certificación vencida | INELIGIBLE con motivo |
| ELG-03 | vigencia termina durante cobertura cuando se exige periodo completo | INELIGIBLE |
| CMP-01 | 6+ sin requisito configurado | no se abre concurso |
| CMP-02 | candidato elegible no acepta | no entra al ranking |
| CMP-03 | reglas de examen sin confirmar | ranking bloqueado |
| CMP-04 | mayor examen | mejor ranking |
| CMP-05 | empate | aplica regla configurada |
| CMP-06 | cambio de calificación | queda PENDING, no cambia resultado |
| CMP-07 | mismo usuario intenta aprobar su revisión | bloqueado |
| CMP-08 | segundo usuario aprueba | nueva calificación aplicada y auditada |
| CMP-09 | revisión rechazada | historial permanece REJECTED |
| CMP-10 | inconformidad abierta | adjudicación bloqueada |
| CMP-11 | ganador dejó de estar disponible | adjudicación bloqueada |
| WF-01 | fecha inicial | asignación pasa SCHEDULED→ACTIVE |
| WF-02 | fecha final | asignación COMPLETED + regreso al nivel base |
| WF-03 | cobertura cancelada | Workflow despierta y no reactiva |
| DOC-01 | audio | transcripción → borrador, sin asignación |
| DOC-02 | PDF/imagen | markdown/extracción → borrador |
| DOC-03 | mismo borrador consumido dos veces | un solo expediente |
| SEC-01 | supervisor Grupo A intenta modificar Grupo B | 403 |
| SEC-02 | empleado consulta expediente ajeno | 403 |
| SEC-03 | MCP consulta otra organización | no devuelve datos |
| SEC-04 | archivo apunta a entidad de otra organización | bloqueado |
| AUD-01 | modificación crítica | audit_event append-only |
| AUD-02 | intento UPDATE/DELETE de audit_events | trigger aborta |
| ID-01 | mismo Idempotency-Key al crear cobertura | mismo resultado, no duplicado |
| BAK-01 | exportar D1 y restaurar a staging | conteos y relaciones coinciden |

## Puerta de producción

No desplegar producción hasta que los casos críticos `BR`, `ROT`, `LVL`, `ELG`, `CMP`, `WF`, `SEC` y `AUD` hayan sido ejecutados con evidencia de resultado.
