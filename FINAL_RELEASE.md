# Release final autoritativa

La única ruta autorizada para una instalación nueva es:

- GitHub Actions: **Deploy Certified Final**
- Workflow: `.github/workflows/deploy-certified-final.yml`
- Configurador: `scripts/render-wrangler-certified-final.ts`
- Worker: `apps/worker/src/index-certified-final.ts`
- Aplicación: `apps/worker/src/app-certified.ts`
- Creación segura: `routes/coverages-safe.ts`
- Disponibilidad por periodo: `services/availability-service.ts`
- Rotación y concurso: `services/coverage-initialization-safe.ts`
- Correo Cloudflare: `processing-release.ts` y `cloudflare-email-adapter.ts`
- Mantenimiento y reconciliación: `maintenance-certified.ts`
- MCP: Worker separado, tokenizado y de solo lectura

Los demás entrypoints y workflows se conservan únicamente como historial incremental. No deben elegirse para staging ni producción.

## Puertas obligatorias antes de producción

1. `docs/verification/latest.md` debe mostrar todos los controles en `success`.
2. Local E2E debe pasar.
3. CodeQL y Dependency Review no deben tener hallazgos altos o críticos abiertos.
4. Debe completarse una restauración de respaldo en ambiente aislado.
5. Debe completarse `docs/operations/connection-checklist.md`.
6. Responsables funcionales de SUTERM/CFE deben aprobar calendario, requisitos, examen, desempates y roles.
7. Responsables jurídicos deben validar tratamiento de datos, retención documental y uso laboral.

## Regla de confianza

La IA no asigna plazas, no decide elegibilidad, no altera notas, no define ganadores y no aprueba movimientos. Solo extrae datos, redacta comunicaciones y explica información registrada. Las decisiones pertenecen al motor determinista y a los usuarios autorizados.
