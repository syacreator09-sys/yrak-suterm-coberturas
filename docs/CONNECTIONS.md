# Conexiones pendientes para el handoff

1. Crear D1 y reemplazar `REPLACE_WITH_D1_DATABASE_ID`; aplicar `migrations/`.
2. Crear R2 `yrak-suterm-evidence`.
3. Desplegar `GroupCoordinator` y `CoverageWorkflow` mediante Wrangler.
4. Crear Queue `yrak-notifications`.
5. Verificar dominio/remitente de Email Service y fijar `EMAIL_FROM`.
6. Fijar `INBOUND_EMAIL_ORGANIZATION_ID` al ID de la organización que recibe el buzón; nunca se elige la primera organización automáticamente.
7. Configurar Cloudflare Access y provisionar usuarios con el mismo correo autenticado.
8. MCP: fijar `MCP_ORGANIZATION_ID`, luego ejecutar `wrangler secret put MCP_API_TOKEN` en `apps/mcp-worker`. El token **no** vive en `wrangler.jsonc`.
9. Agregar proveedor de IA como secret/configuración cuando se habiliten extracción y transcripción. No es necesario para rotación, concurso, auditoría ni regreso automático.
10. Importar grupos, niveles, transiciones, personal, requisitos, colas, calendario y usuarios reales.

Antes de producción ejecutar localmente: instalación, typecheck, pruebas, migración limpia, smoke tests, prueba de respaldo/restauración y validación de permisos.
