# Entrega autorizada

La única ruta autorizada para staging y producción es:

- Workflow: `.github/workflows/deploy-audited.yml`
- Nombre en GitHub Actions: **Deploy Audited Release**
- Entrypoint: `apps/worker/src/index-audited.ts`
- Aplicación: `apps/worker/src/app-audited.ts` → `app-final.ts`
- Cola: `apps/worker/src/processing-release.ts`
- Configurador: `scripts/render-wrangler-audited.ts`

Los archivos `index.ts`, `index-final.ts`, `index-release.ts` y workflows anteriores se conservan como historial de construcción y compatibilidad local. No deben utilizarse para un despliegue nuevo.

## Puertas obligatorias

No promover a producción hasta que:

1. `docs/verification/latest.md` muestre todos los controles en `success`.
2. La prueba Local E2E termine correctamente.
3. CodeQL y Dependency Review no tengan hallazgos críticos o altos sin resolver.
4. Se haya restaurado un respaldo en un ambiente aislado.
5. Se hayan completado las conexiones de `docs/operations/connection-checklist.md`.
6. El reglamento operativo haya sido validado por responsables de SUTERM/CFE.

## Principio de seguridad

Los agentes de IA pueden extraer y redactar. Los motores deterministas y las aprobaciones humanas controlan elegibilidad, rotación, calificaciones, ganador, asignación y regreso al nivel base.
