# Release Candidate — build/clean-v1

Esta rama es la candidata limpia para sustituir el prototipo experimental previo.

## Criterios ya cubiertos por implementación

- una sola regla central 1–5 / 6+;
- nivel base inmutable;
- transiciones explícitas;
- rotación auditable;
- concurso auditable;
- aprobación humana;
- doble control de correcciones de nota;
- inconformidades;
- concurrencia con Durable Objects;
- regreso automático mediante Workflow;
- evidencia R2 + SHA-256;
- correo/transcripción/documentos como intake, no como decisión;
- agentes y MCP sin autoridad laboral;
- single-organization guard;
- scripts y documentación de handoff.

## Esta rama NO debe fusionarse aún si se pretende producción

Falta evidencia ejecutada de:

1. `pnpm install`;
2. `pnpm typecheck`;
3. `pnpm test`;
4. `pnpm build` / Wrangler dry-run;
5. migración D1 limpia;
6. `scripts/e2e_api.py`;
7. permisos/Access en staging;
8. correo/R2/AI;
9. concurrencia real;
10. backup + restore.

Es correcto abrir el Pull Request como **Draft** hasta que esa validación se haga al regresar.

## Política de cambios a partir de aquí

No agregar reglas laborales nuevas por inferencia. Todo cambio de negocio debe:

- citar la regla oficial o decisión aprobada;
- versionar configuración cuando aplique;
- añadir prueba;
- conservar auditoría histórica.
