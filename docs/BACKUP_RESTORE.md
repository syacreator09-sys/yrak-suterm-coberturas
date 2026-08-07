# Backup y restore

## Exportar D1 remoto

```bash
./scripts/backup-d1.sh
```

El archivo SQL se guarda en `backups/` y no debe versionarse en Git.

## Restaurar

La restauración es destructiva. Debe probarse primero sobre una base nueva o staging:

```bash
./scripts/restore-d1.sh backups/yrak-YYYYMMDD-HHMMSS.sql
```

Después del restore comprobar:

- organizaciones;
- grupos y niveles;
- trabajadores y nivel base;
- requisitos;
- coberturas y asignaciones;
- colas y eventos de rotación;
- concursos/calificaciones;
- auditoría.

Nunca sustituir una base de producción sin validar primero una restauración independiente.
