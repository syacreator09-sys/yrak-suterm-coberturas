# Seguridad

- Principio de mínimo privilegio por organización, grupo y rol.
- No se aceptan secretos, tokens o llaves en el repositorio.
- Los archivos se validan por tamaño, MIME y hash antes de persistir.
- Las auditorías son append-only desde la aplicación.
- Las acciones críticas exigen autorización explícita y `correlationId`.
- La IA nunca recibe autoridad de escritura sobre decisiones laborales.
- Todo endpoint debe validar pertenencia de recursos a la organización activa.
