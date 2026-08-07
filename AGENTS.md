# Reglas obligatorias para agentes de desarrollo

1. Nunca modificar `employee.baseLevelId` por una cobertura temporal.
2. Coberturas de 1 a 5 días inclusive usan `ROTATION`.
3. Coberturas de 6 días o más usan `COMPETITION`.
4. La IA no puede seleccionar ganador, modificar calificaciones ni aprobar asignaciones.
5. Toda transición de nivel debe existir en `level_transitions`.
6. Toda mutación crítica debe producir auditoría.
7. Toda operación susceptible a reintentos debe ser idempotente.
8. No guardar secretos en Git.
9. Las políticas aún no confirmadas deben configurarse; no inventarlas en código.
10. Los servicios de dominio no importan Cloudflare, Hono ni SDKs de modelos.
