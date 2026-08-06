# Entrega final autoritativa

La única ruta que debe ejecutarse para una instalación nueva es:

- GitHub Actions: **Deploy Final Authoritative**
- Workflow: `.github/workflows/deploy-final-authoritative.yml`
- Worker principal: `apps/worker/src/index-certified-final.ts`
- Configurador principal: `scripts/render-wrangler-certified-final.ts`
- MCP de solo lectura: `apps/mcp-readonly/src/index.ts`
- Configurador MCP: `scripts/render-mcp-readonly.ts`

Esta combinación incluye:

- reglas 1–5 / 6+;
- conteo natural, laboral o por turnos;
- disponibilidad por periodo;
- Durable Object contra doble asignación;
- workflow de inicio, cierre y regreso;
- reconciliación automática de reservas huérfanas;
- requisitos, exámenes, ranking, revisiones e inconformidades;
- audios, imágenes, PDFs y correo como borradores con revisión humana;
- panel, API, OpenAPI, importaciones, notificaciones y auditoría;
- MCP estándar separado, tokenizado, limitado a una organización y sin herramientas de escritura.

Los workflows y entrypoints anteriores son historial incremental y no deben utilizarse.

## Condición de aceptación

No declarar producción lista hasta que:

1. `docs/verification/latest.md` muestre todos los controles en `success`.
2. Local E2E pase.
3. CodeQL y Dependency Review estén limpios de hallazgos altos/críticos.
4. Staging complete el checklist funcional.
5. Se restaure exitosamente un respaldo.
6. SUTERM/CFE valide reglas y responsables jurídicos validen datos y retención.
