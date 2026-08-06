# YRAK Coberturas — instrucciones para Claude Code

## Reglas innegociables

1. Coberturas de 1 a 5 días inclusive usan rotación sin concurso.
2. Coberturas de 6 días o más requieren requisitos y examen de concurso.
3. Nunca modificar `employees.base_level_id` por una cobertura temporal.
4. Toda transición de nivel debe existir en `level_transitions`.
5. La IA nunca selecciona candidatos, modifica calificaciones o aprueba asignaciones.
6. Toda operación crítica debe ser idempotente y producir un evento de auditoría.
7. No guardar secretos, datos personales reales ni archivos de producción en Git.
8. Escribir pruebas antes de modificar reglas de negocio.
9. Ejecutar `pnpm lint`, `pnpm typecheck` y `pnpm test` antes de proponer merge.
10. Mantener la atribución MIT de Forja en todo código derivado.

## Convenciones

- TypeScript estricto.
- Zod en todos los límites externos.
- Fechas ISO 8601 en UTC; zona operativa almacenada por organización.
- Errores de dominio tipados, sin mensajes ambiguos.
- Repositorios y motores deterministas separados de Workers y LLM.
