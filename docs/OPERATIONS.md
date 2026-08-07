# Operación funcional

## Cobertura corta 1–5

1. Crear expediente.
2. `POST /v1/coverage-cases/:id/rotation/select`.
3. Revisar candidato y evidencia de selección.
4. `POST /v1/coverage-cases/:id/approve`.
5. Workflow activa en fecha inicial.
6. Al terminar, `POST /v1/coverage-cases/:id/complete` cierra, registra regreso al nivel base y mueve al final de la cola.

## Cobertura larga 6+

1. Crear expediente.
2. `POST /v1/competitions/cases/:caseId/evaluate`.
3. Capturar examen por candidato.
4. Calcular ranking.
5. Resolver inconformidades si existen.
6. `POST /v1/competitions/:competitionId/award`.
7. Workflow activa en la fecha inicial.
8. Cierre regresa al nivel base.

La IA nunca participa en los pasos de selección, ranking o aprobación.
