# Bootstrap inicial

Después de crear D1 y aplicar migraciones, antes de existir usuarios:

1. Guardar `BOOTSTRAP_TOKEN` como secret del API Worker.
2. Ejecutar una sola vez `POST /bootstrap` con header `x-yrak-bootstrap-token`.
3. Cuerpo:

```json
{"organizationId":"suterm-cfe","organizationName":"Proyecto SUTERM / CFE","timezone":"America/Mexico_City","adminEmail":"admin@example.com","adminDisplayName":"Administrador"}
```

El endpoint deja de funcionar en cuanto existe una organización. Después la autenticación normal se hace con Cloudflare Access y la tabla `users`.
