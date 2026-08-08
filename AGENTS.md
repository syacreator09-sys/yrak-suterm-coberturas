# Reglas obligatorias para agentes de desarrollo

1. Nunca modificar `employee.baseLevelId` por una cobertura temporal.
2. Coberturas de 1 a 5 días inclusive usan `ROTATION`.
3. Coberturas de 6 días o más usan `COMPETITION`.
4. La IA no puede seleccionar ganador, modificar calificaciones, mover la cola de rotación ni aprobar asignaciones.
5. Toda transición de nivel debe existir en `level_transitions`.
6. Toda mutación crítica debe producir auditoría.
7. Toda operación susceptible a reintentos debe ser idempotente.
8. No guardar secretos en Git, PRs, issues, logs ni prompts.
9. Las políticas aún no confirmadas deben configurarse; no inventarlas en código.
10. Los servicios de dominio no importan Cloudflare, Hono ni SDKs de modelos.
11. La autorización por organización/grupo se valida en backend/DB; nunca se confía sólo en la UI.
12. En staging/producción la identidad del API requiere JWT firmado de Cloudflare Access. `x-yrak-user-email` es exclusivamente loopback + `APP_ENV=development`.
13. MCP es estrictamente read-only. Cualquier mutación debe pasar por API/dominio autorizado.
14. D1 es la fuente canónica de estado laboral. RAG/Supabase/Redis no sustituyen coberturas, rotaciones, concursos o asignaciones.
15. Un proveedor/modelo nunca se considera saludable sólo porque existe una key; se requiere smoke sintético observado.
16. Antes de staging/merge ejecutar el gate de `docs/CLONE_TEST_CONNECT.md` y conservar evidencia del resultado.
17. Si una verificación no se pudo ejecutar, reportarla como `UNVERIFIED`; no inferir que pasó.
18. No renumerar migraciones aplicadas para ocultar gaps; investigar historial y usar cambios forward-only.
19. No promover `main` ni producción automáticamente desde un agente.
20. No debilitar CSP, CORS, Access, RBAC, scopes o validaciones para hacer pasar una prueba.
