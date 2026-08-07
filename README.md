# YRAK SUTERM Coberturas

Plataforma auditable para gestionar coberturas temporales, rotaciones y concursos por nivel.

## Reglas centrales

- **1 a 5 días inclusive:** rotación, sin concurso y sin requisito académico de concurso.
- **6 días o más:** elegibilidad por requisitos + examen de concurso.
- Una asignación temporal **nunca modifica el nivel base** del trabajador.
- Una cobertura sólo puede usar transiciones autorizadas, por ejemplo `nivel 7 -> nivel 8`.
- Al terminar la cobertura, la persona regresa a su nivel base.
- La IA puede extraer, explicar y redactar; **no selecciona candidatos, no cambia calificaciones y no aprueba resultados**.
- Toda operación crítica es trazable, idempotente y auditable.

## Arquitectura

Monorepo TypeScript para Cloudflare Workers, D1, Durable Objects, Workflows, R2, Queues y MCP. El dominio y los motores de decisión permanecen desacoplados de Cloudflare y de cualquier proveedor de IA.

## Desarrollo

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Las conexiones reales de Cloudflare, correo, IA y datos CFE/SUTERM se realizan después; el repositorio no contiene secretos.
