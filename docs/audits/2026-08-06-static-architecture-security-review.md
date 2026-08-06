# Revisión estática de arquitectura y seguridad

Fecha: 2026-08-06

## Alcance

Revisión del diseño y código preparado en la rama `build/end-to-end-v1` para la plataforma YRAK SUTERM Coberturas.

Esta revisión distingue tres estados:

- **Implementado:** existe código, esquema, control o documentación en el repositorio.
- **Verificación automática pendiente:** requiere que GitHub Actions ejecute instalación, tipos, pruebas, build y migraciones.
- **Validación externa pendiente:** requiere Cloudflare real, datos de prueba, correo, proveedor de IA, usuarios y aprobación funcional/jurídica.

## Controles implementados

### Reglas de negocio

- Frontera fija: 1–5 días rotación; 6+ días concurso.
- Nivel base separado de asignación temporal.
- Transición inmediata inferior validada en D1.
- Regreso al nivel base al cerrar la cobertura.
- Movimiento al final de la fila únicamente al completar una cobertura corta.
- Requisitos y disponibilidad evaluados antes de admitir candidatos a concurso.
- Ranking y desempates deterministas.
- Correcciones de calificación append-only y con segundo actor.
- Inconformidades formales sin modificación automática del resultado.

### Concurrencia e idempotencia

- Durable Object por grupo para reservar personas.
- Estados `RESERVED` y `ASSIGNED` en filas.
- Idempotency-Key obligatoria en mutaciones críticas.
- Workflow durable para inicio, espera y cierre.
- Reconciliación programada de reservas huérfanas.
- Recuperación de outbox bloqueado mediante leases.

### Seguridad de acceso

- Cloudflare Access JWT como autenticación de producción.
- Roles organizacionales y roles limitados por grupo.
- Guardas adicionales en aprobaciones, cancelación y terminación.
- Alcance propio para trabajadores.
- MCP limitado a una organización y solo lectura.
- Triggers D1 contra referencias cruzadas entre organizaciones.

### Integridad y auditoría

- Auditoría append-only.
- Eventos de rotación e inconformidad append-only.
- Calificación original inmutable.
- Definiciones de requisitos versionadas e inmutables.
- Fechas contadas por expediente congeladas en base de datos.
- Valores anterior/nuevo, actor, motivo, regla y correlación en eventos críticos.

### Archivos e IA

- Lista permitida de MIME.
- Validación de magic bytes.
- Límites de tamaño.
- SHA-256 por archivo.
- R2 para originales.
- Separación entre original, texto extraído y borrador.
- Audios, imágenes, PDFs y correos únicamente producen borradores.
- Revisión humana obligatoria antes de crear expediente.
- OpenAI configurado con `store:false`.
- La IA no posee herramientas para decidir ganadores o modificar resultados.

### Operación

- Importación y exportación de personal.
- Carga masiva de requisitos, cumplimiento y turnos.
- Panel operativo.
- Correo entrante y saliente.
- Outbox y reintentos.
- Runbooks de despliegue, conexiones, respaldo y restauración.
- OpenAPI.
- Workflow autoritativo `Deploy Certified Final`.

## Pruebas preparadas

- Unitarias para frontera 5/6, rotación, elegibilidad, ranking, calendario y CSV.
- Contratos para migraciones e invariantes entre organizaciones.
- Local E2E con Worker, D1 migrada y semilla controlada.
- Caso de 5 días por rotación.
- Caso de 6 días por concurso.
- Verificación del nivel base después de aprobar asignación.
- Smoke test de health, readiness y protección de API.
- CodeQL y Dependency Review.

## Hallazgos y estado

### P0 críticos

No se identificó deliberadamente ningún flujo que permita a la IA asignar, cambiar notas o aprobar. La ausencia de hallazgos P0 en esta revisión estática no sustituye pruebas ejecutadas ni pentest.

### P1 altos

1. **CI aún no confirmado desde esta revisión.** No afirmar que tipos, build, pruebas y migraciones pasan hasta que `docs/verification/latest.md` muestre `success`.
2. **Cloudflare Email adapter no validado contra una cuenta real.** Requiere staging con remitente autorizado.
3. **Procesamiento PostalMime y Workers AI no validado con mensajes reales.** Requiere correo de prueba y audios OPUS.
4. **Políticas jurídicas y laborales no aprobadas.** El software no sustituye reglamento, contrato colectivo ni revisión de protección de datos.

### P2 medios

1. La cobertura en cadena está modelada, pero el flujo operativo autoritativo selecciona el inmediato inferior para la vacante principal. Una cadena completa debe habilitarse únicamente cuando el reglamento confirme que todas las posiciones descendentes deben reemplazarse.
2. Una extensión de periodo debe tratarse mediante cancelación/reemplazo o una futura función formal de revisión; no se permite editar silenciosamente fechas de un expediente activo.
3. Los workflows históricos permanecen en el repositorio; `FINAL_RELEASE.md` identifica cuál debe utilizarse.

## Verificaciones obligatorias restantes

- CI completa en GitHub.
- Migraciones D1 locales y remotas.
- Local E2E.
- Staging Cloudflare.
- Dos solicitudes simultáneas reales.
- Correo entrante y saliente.
- Audio OPUS, imagen y PDF.
- MCP desde ChatGPT o Claude.
- Restauración de D1 y R2.
- Pentest de staging.
- Aprobación funcional y jurídica.

## Conclusión

La arquitectura y controles necesarios están definidos e implementados en el repositorio. La plataforma no debe declararse lista para producción hasta completar las verificaciones automáticas y externas anteriores. La ruta autoritativa de entrega está documentada en `FINAL_RELEASE.md`.
