# Conexiones pendientes para el handoff

El código debe permanecer utilizable sin credenciales reales. Al regresar se conectan estos recursos:

1. **D1**: crear `yrak-suterm-coberturas`, sustituir `REPLACE_WITH_D1_DATABASE_ID` y aplicar `migrations/`.
2. **R2**: crear `yrak-suterm-evidence` y mantener el binding `EVIDENCE_BUCKET`.
3. **Durable Objects**: el Worker declara `GroupCoordinator` con SQLite mediante `exports`; Wrangler lo provisionará al desplegar.
4. **Workflows**: mantener binding `COVERAGE_WORKFLOW` para `CoverageWorkflow`.
5. **Queues**: crear `yrak-notifications` para el outbox.
6. **Email Service**: verificar dominio, fijar `EMAIL_FROM` y binding `EMAIL`.
7. **Cloudflare Access**: proteger API/panel y provisionar usuarios con el mismo correo autenticado.
8. **MCP**: guardar `MCP_API_TOKEN` como secret, no dentro de `wrangler.jsonc`; conectar ChatGPT/Claude al endpoint `/mcp` del Worker MCP cuando se configure el cliente.
9. **IA**: agregar las claves del proveedor elegido como secrets y activar el adaptador. Ninguna clave es necesaria para rotación, concurso o auditoría.
10. **Datos reales**: importar grupos, niveles, transiciones, personal, requisitos, colas iniciales, calendarios y usuarios.

Antes de producción: ejecutar typecheck, pruebas, migración limpia, smoke test de staging, restore de respaldo y revisión de permisos.
