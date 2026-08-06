# Respaldo y restauración

## D1

Antes de cada despliegue de producción:

```bash
pnpm wrangler d1 export DB --remote --output backups/yrak-$(date +%Y%m%d-%H%M%S).sql --config apps/worker/wrangler.generated.json
```

Cifrar el archivo y transferirlo al repositorio seguro de respaldos. No confirmarlo en Git.

## R2

R2 contiene evidencias, audios, imágenes y correos originales. La política operativa debe habilitar versionado o réplica a un segundo bucket. Verificar hashes SHA-256 contra `attachments`.

## Prueba de restauración

1. Crear una D1 temporal vacía.
2. Importar el SQL exportado.
3. Apuntar un Worker de recuperación a esa D1 y a un bucket de réplica.
4. Ejecutar `/ready`.
5. Consultar expedientes, rotaciones, concursos y auditoría.
6. Verificar al menos diez archivos por SHA-256.
7. Documentar fecha, duración, responsable y resultado.

Un respaldo no se considera válido hasta restaurarlo correctamente.
