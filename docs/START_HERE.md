# START HERE — YRAK SUTERM Coberturas

Esta rama contiene la construcción limpia. El software está preparado para que la siguiente etapa sea **conectar y verificar**, no rediseñar el dominio.

## Lo que ya está construido

- monorepo TypeScript;
- D1 y migraciones;
- grupos, niveles y transiciones explícitas;
- trabajadores y nivel base inmutable;
- rotación 1–5 días;
- requisitos + concurso 6+;
- rechazo de rotación configurable;
- calificaciones con revisión de segundo usuario;
- inconformidades;
- asignaciones temporales y regreso automático;
- cascadas configurables;
- Durable Object para reservas concurrentes;
- Workflows de inicio/cierre;
- R2 para evidencias;
- Email Service/outbox y correo entrante MIME;
- procesamiento audio/PDF/imagen → borrador;
- agentes runtime de intake/auditoría/comunicación/soporte;
- MCP de sólo lectura;
- panel administrativo;
- portal del trabajador;
- importadores, reportes y auditoría;
- pruebas unitarias/aceptación escritas;
- scripts de migración, smoke, backup y restore.

## Lo que NO se afirma todavía

No se afirma que compile, que las migraciones hayan corrido, que las pruebas pasen ni que Cloudflare esté desplegado. Eso requiere ejecución real posterior.

## Secuencia al regresar

1. Crear recursos Cloudflare indicados en `CONNECTIONS.md`.
2. Copiar `.dev.vars.example` y cargar secrets con Wrangler.
3. Reemplazar IDs `REPLACE_WITH_*`.
4. Ejecutar con `bash scripts/migrate-local.sh` y después `bash scripts/verify-local.sh`.
5. Ejecutar bootstrap inicial según `BOOTSTRAP.md`.
6. Cargar catálogos y datos reales.
7. Probar `TEST_MATRIX.md` en staging.
8. Conectar correo/MCP/agentes.
9. Probar backup/restore.
10. Sólo después desplegar producción.

No es necesario habilitar GitHub Actions.
