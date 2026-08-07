# Respaldo completo D1 + R2

Un respaldo de YRAK está completo sólo cuando incluye:

1. **D1**: estructura/datos (personal, reglas, coberturas, concurso, auditoría, metadata de evidencias).
2. **R2**: binarios (PDF, imágenes, audio, correo original, certificaciones y demás evidencias).

## D1

```bash
bash scripts/backup-d1.sh
```

## R2

Crear credenciales S3 para el bucket R2 y configurar temporalmente:

```bash
export CLOUDFLARE_ACCOUNT_ID=...
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export YRAK_R2_BUCKET=yrak-suterm-evidence
bash scripts/backup-r2.sh
```

Se genera un archivo `.sha256` junto al directorio de respaldo.

## Restauración

Siempre restaurar primero a staging:

```bash
bash scripts/restore-d1.sh backups/yrak-....sql
bash scripts/restore-r2.sh backups/r2-....
```

Luego comparar `attachments.sha256` de D1 contra los objetos restaurados antes de considerar válida la restauración.

Las credenciales S3 de respaldo no se guardan en Git ni en archivos públicos del panel.
