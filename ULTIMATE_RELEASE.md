# Release ultimate autoritativa

La única ruta autorizada para staging y producción es:

- GitHub Actions: **Deploy Ultimate**
- Workflow: `.github/workflows/deploy-ultimate.yml`
- Worker principal: `apps/worker/src/index-ultimate.ts`
- Aplicación: `apps/worker/src/app-clean-final-v2.ts`
- Configurador: `scripts/render-wrangler-ultimate.ts`
- MCP: `apps/mcp-readonly/src/index.ts`
- Configurador MCP: `scripts/render-mcp-readonly.ts`

Esta release elimina rutas duplicadas, usa el motor seguro de disponibilidad tanto para captura manual como para borradores de IA, reclama borradores antes de convertirlos y limpia reclamaciones vencidas automáticamente.

## Componentes autoritativos

- Cobertura nueva: `routes/coverages-safe.ts`.
- Gestión, cancelación y aprobación: `routes/coverage-management-v2.ts`.
- Intake revisado: `routes/intake-safe-v3.ts`.
- Disponibilidad: `services/availability-service.ts`.
- Rotación/concurso: `services/coverage-initialization-safe.ts`.
- Conteo de días: `services/coverage-duration-service.ts`.
- Regreso y cierre: `services/completion-service.ts`.
- Reconciliación: `maintenance-final.ts` y `maintenance-certified.ts`.
- Correo: `email-intake.ts`, `processing-release.ts` y `cloudflare-email-adapter.ts`.
- MCP: aplicación separada y de solo lectura.

Los demás workflows y entrypoints son historial incremental. No deben ejecutarse.

## Puertas obligatorias

1. Todos los controles automáticos en `success`.
2. Local E2E aprobado.
3. Seguridad sin hallazgos altos/críticos abiertos.
4. Staging completo.
5. Restauración de respaldo validada.
6. Reglas y datos aprobados por SUTERM/CFE.
7. Revisión jurídica y de protección de datos.
