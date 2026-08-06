# Despliegue reproducible

## Recursos previos

Crear D1, R2 y Queue en Cloudflare. Registrar nombres e identificadores en el GitHub Environment `staging` o `production`.

## Configuración generada

```bash
pnpm tsx scripts/render-wrangler.ts worker staging
pnpm tsx scripts/render-wrangler.ts mcp staging
```

Los archivos `wrangler.generated.json` están ignorados por Git y no contienen secretos.

## Secretos

Desde `apps/worker`:

```bash
pnpm wrangler secret put OPENAI_API_KEY --config wrangler.generated.json
pnpm wrangler secret put BOOTSTRAP_TOKEN --config wrangler.generated.json
```

Desde `apps/mcp-server`:

```bash
pnpm wrangler secret put MCP_SERVICE_TOKEN --config wrangler.generated.json
```

Nunca escribir secretos en configuración, commits, issues o logs.

## Migrar y desplegar

```bash
pnpm wrangler d1 migrations apply DB --remote --config apps/worker/wrangler.generated.json
pnpm wrangler deploy --config apps/worker/wrangler.generated.json
pnpm wrangler deploy --config apps/mcp-server/wrangler.generated.json
APP_ORIGIN=https://dominio-final.example pnpm tsx scripts/smoke-test.ts
```

## Promoción

1. Desplegar `staging`.
2. Importar datos de prueba sin información real.
3. Ejecutar todos los escenarios del checklist.
4. Respaldar producción.
5. Ejecutar el workflow manual `Deploy` con `production`.
6. Aplicar migraciones antes del Worker.
7. Ejecutar smoke test.
8. Revisar logs, mensajes y auditoría.

## Reversión

- El código se revierte desplegando el SHA anterior.
- Las migraciones son hacia adelante; no ejecutar SQL destructivo durante una reversión.
- Restaurar D1 únicamente con respaldo validado y autorización formal.
