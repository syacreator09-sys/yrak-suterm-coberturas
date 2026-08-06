# YRAK Coberturas

Plataforma privada y auditable para administrar coberturas temporales de personal SUTERM.

## Reglas confirmadas

- Coberturas de **1 a 5 días inclusive**: rotación sin examen de concurso.
- Coberturas de **6 días o más**: validación de requisitos y examen de concurso.
- Una persona del nivel inmediato inferior puede cubrir temporalmente el nivel superior.
- Ejemplo: nivel 7 cubre nivel 8 y, al finalizar, regresa a su nivel base 7.
- La IA interpreta documentos y redacta comunicaciones; nunca selecciona ganadores.

## Arquitectura

- Cloudflare Workers + Hono
- D1, Durable Objects, Workflows, R2, Queues y Vectorize
- TypeScript, Zod, pnpm y Turborepo
- Vitest y Playwright

## Desarrollo

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm dev
```

Consulta `docs/superpowers/specs/` y `docs/superpowers/plans/` para el diseño y el plan completo.
