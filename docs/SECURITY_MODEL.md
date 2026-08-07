# Modelo de seguridad

## Fronteras de confianza

1. **Navegador ↔ Cloudflare Access**: identidad humana.
2. **Access ↔ API Worker**: usuario/rol/grupo resueltos contra D1.
3. **API Worker ↔ D1/R2/DO/Workflow/Queue/Email**: servicios internos.
4. **MCP/Agent Worker**: tokens independientes y organización fija.
5. **Proveedores IA**: sólo reciben información necesaria para transcribir/extraer/redactar; no reciben autoridad de negocio.

## Autorización

- `ADMIN`: configuración global de la organización.
- `HR`: personal, requisitos y procesos autorizados.
- `SUPERVISOR`: limitado a grupos asignados.
- `COMMITTEE`: concursos/calificaciones según rutas autorizadas.
- `OPERATOR`: operación no aprobatoria.
- `EMPLOYEE`: sólo expediente propio/participación/rechazo/inconformidad.
- `AUDITOR`: lectura.

La API valida organización y, cuando aplica, grupo incluso si se manipulan IDs o URLs.

## Decisiones laborales

Ningún modelo de IA puede:

- elegir el siguiente de una rotación;
- declarar elegibilidad por su cuenta;
- calcular ranking;
- alterar calificaciones;
- aprobar asignaciones;
- adjudicar concursos;
- cambiar nivel base.

Estas operaciones dependen de SQL + motores deterministas + acciones humanas explícitas.

## Archivos

- MIME permitido;
- tamaño máximo;
- SHA-256;
- R2 separado de metadata D1;
- target validado por organización;
- correo original preservado como `.eml` para evidencia.

## Auditoría

`audit_events` es append-only desde la aplicación y tiene triggers D1 que bloquean `UPDATE`/`DELETE`. Cambios críticos registran actor, rol, before/after, regla, motivo y correlation ID.

## Concurrencia

Durable Object coordina reservas por grupo. D1 conserva además estados `RESERVED`/`ASSIGNED`; el cron libera reservas D1 huérfanas. Las asignaciones activas/futuras se consultan antes de seleccionar/adjudicar.

## Secrets

Secrets sólo mediante Wrangler/Cloudflare. Nunca en Git, Vite público, logs o `wrangler.jsonc`.

## Producción

Antes de producción ejecutar la matriz `TEST_MATRIX.md`, revisar permisos de Cloudflare Access, probar aislamiento entre grupos/organizaciones y restaurar un backup en staging.
