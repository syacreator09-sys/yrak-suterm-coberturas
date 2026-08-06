# Release certificado

La ruta autoritativa más reciente es:

- Workflow: `.github/workflows/deploy-certified.yml`
- GitHub Actions: **Deploy Certified Release**
- Configurador: `scripts/render-wrangler-certified.ts`
- Entrypoint: `apps/worker/src/index-certified.ts`
- Creación de coberturas: `routes/coverages-safe.ts`
- Validación de disponibilidad: `services/availability-service.ts`
- Rotación y concurso seguros: `services/coverage-initialization-safe.ts`

Esta versión agrega a la release empresarial:

- exclusión por ausencias traslapadas;
- exclusión por asignaciones traslapadas;
- registro de candidatos omitidos y motivo;
- elegibilidad de concurso combinando requisitos y disponibilidad;
- rechazo de periodos duplicados para la persona ausente.

No desplegar workflows anteriores. La promoción sigue condicionada a que la verificación automática, Local E2E, seguridad y restauración de respaldo terminen correctamente.
