# Release autoritativo

La única ruta que debe usarse para una instalación nueva es:

- GitHub Actions: **Deploy Production Ready**
- Workflow: `.github/workflows/deploy-production-ready.yml`
- Configurador: `scripts/render-wrangler-production-ready.ts`
- Worker: `apps/worker/src/index-production-ready.ts`
- Aplicación: `apps/worker/src/app-enterprise.ts`
- Seguridad: `app-audited.ts`, guardas de grupo y triggers D1
- Correo: `processing-release.ts` y `cloudflare-email-adapter.ts`
- Mantenimiento: `maintenance.ts`
- MCP: Worker separado y de solo lectura

Los demás entrypoints y workflows se conservan únicamente como historial incremental de construcción. No deben elegirse para staging ni producción.

## Condición para declarar la entrega lista

Todos los controles de `docs/verification/latest.md` deben mostrar `success`, las pruebas Local E2E deben pasar y staging debe completar el checklist de conexiones y restauración de respaldo.
