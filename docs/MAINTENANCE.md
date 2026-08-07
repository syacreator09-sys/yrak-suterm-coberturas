# Worker de mantenimiento

`apps/maintenance-worker` se ejecuta cada 15 minutos y funciona como red de seguridad para tareas que no deben perderse por fallos transitorios.

## Responsabilidades

- vuelve a encolar notificaciones `PENDING` o `FAILED` con menos de 5 intentos;
- expira cumplimiento cuyo `valid_until` ya terminó;
- libera estados D1 `RESERVED` que no tienen una asignación propuesta/activa correspondiente.

El API Worker mantiene sus propios controles; este Worker es una reconciliación independiente para recuperar fallas parciales.

## Despliegue

Reemplazar el D1 ID en `apps/maintenance-worker/wrangler.jsonc` y reutilizar la misma Queue `yrak-notifications`.

```bash
bash scripts/deploy-maintenance.sh
```

No contiene credenciales de correo ni IA y no tiene endpoints de mutación humana.
