# Release limpia final

La única ruta autorizada para staging y producción es:

- GitHub Actions: **Deploy Clean Final**
- Workflow: `.github/workflows/deploy-clean-final.yml`
- Worker principal: `apps/worker/src/index-clean-final.ts`
- Composición de aplicación: `apps/worker/src/app-clean-final.ts`
- Configurador principal: `scripts/render-wrangler-clean-final.ts`
- MCP: `apps/mcp-readonly/src/index.ts`
- Configurador MCP: `scripts/render-mcp-readonly.ts`

Esta versión compone explícitamente todos los módulos autorizados y excluye las rutas heredadas duplicadas de creación de coberturas e intake.

## Flujo autoritativo

- `POST /api/v1/coverages` utiliza disponibilidad por periodo, calendario congelado, transición inmediata y motor seguro.
- `GET /api/v1/coverages` y acciones de gestión utilizan `coverage-management-v2.ts`.
- Los borradores de audio, imagen, PDF y correo se convierten mediante `intake-safe.ts` y el mismo motor seguro.
- La terminación, restauración de fila y reconciliación se ejecutan mediante los servicios certificados.
- El MCP es separado, de solo lectura y limitado a una organización.

No ejecutar workflows de despliegue anteriores. Se mantienen únicamente como historial de construcción.

## Puertas de aceptación

1. Verificación automática completa en `success`.
2. Local E2E aprobado.
3. CodeQL y revisión de dependencias sin hallazgos altos/críticos abiertos.
4. Staging funcional con correo, audio OPUS, imagen, PDF, OpenAI y MCP.
5. Restauración probada de D1 y R2.
6. Aprobación funcional, laboral y jurídica.
