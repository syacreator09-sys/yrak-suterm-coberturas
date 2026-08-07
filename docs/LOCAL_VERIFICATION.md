# Verificación local sin GitHub Actions

Este repositorio no depende de GitHub Actions.

```bash
./scripts/verify-local.sh
./scripts/migrate-local.sh
```

Para smoke test con `wrangler dev` en `APP_ENV=development`:

```bash
API_BASE_URL=http://127.0.0.1:8787 \
YRAK_TEST_EMAIL=admin@example.com \
./scripts/smoke-api.sh
```

Las pruebas no se consideran ejecutadas hasta que una persona corra estos comandos y revise la salida. El hecho de que las pruebas estén versionadas en Git no implica que hayan pasado.
