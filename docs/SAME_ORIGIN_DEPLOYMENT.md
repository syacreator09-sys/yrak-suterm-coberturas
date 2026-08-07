# Topología mismo-origen recomendada

Para navegador + Cloudflare Access, la configuración recomendada evita CORS y cookies cross-site:

```text
https://yrak.example.com/          → panel o portal estático
https://yrak.example.com/v1/*     → API Worker
https://yrak.example.com/health   → API Worker
```

Cloudflare Access protege el hostname/aplicación y el navegador envía la misma sesión al UI y a la API.

## Desarrollo local

`apps/admin-web/vite.config.ts` y `apps/employee-portal/vite.config.ts` proxifican `/v1`, `/health` y `/ready` a `http://127.0.0.1:8787`. Por ello `VITE_API_BASE_URL` puede dejarse vacío durante desarrollo normal.

## Producción

Preferir un dominio propio y enrutar el path `/v1/*` al API Worker. Mantener `VITE_API_BASE_URL` vacío para llamadas relativas.

Si deliberadamente se decide usar un dominio API diferente, deberá añadirse una política CORS explícita y revisar `credentials`/Cloudflare Access. Esa arquitectura no es la predeterminada de YRAK porque amplía innecesariamente la superficie de autenticación.
