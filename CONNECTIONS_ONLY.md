# Conexiones finales sin modificar código

## Orden exacto

### 1. Crear recursos Cloudflare

Por cada ambiente (`staging` y `production`):

1. D1.
2. Bucket R2 privado.
3. Queue.
4. Aplicación Cloudflare Access.
5. Dominio remitente de correo.
6. Dirección o direcciones de Email Routing.

### 2. Completar GitHub Environment

Crear los Environments `staging` y `production`, cargar las variables y secretos enumerados en `docs/operations/connection-checklist.md` y exigir aprobación manual para `production`.

### 3. Ejecutar el despliegue autorizado

En GitHub Actions seleccionar:

```text
Deploy Certified Release
```

Primero `staging`. No ejecutar workflows anteriores.

### 4. Crear la organización inicial

Ejecutar una sola vez `/bootstrap` con el secreto `BOOTSTRAP_TOKEN`. Después eliminar o rotar el token.

### 5. Configurar estructura laboral

Desde panel/API:

1. Grupos.
2. Niveles.
3. Transiciones inmediatas, por ejemplo nivel 7 → nivel 8.
4. Regla de conteo: naturales, laborales o turnos.
5. Días festivos o calendarios de turnos.
6. Requisitos de cada nivel.
7. Calificación mínima y desempates.

### 6. Cargar personal y requisitos

- Personal: CSV.
- Requisitos: endpoint `/api/v1/bulk/requirements`.
- Cumplimiento: `/api/v1/bulk/employee-requirements`.
- Turnos: `/api/v1/bulk/shifts`.
- Evidencias: carga de adjuntos y asociación a requisitos.

### 7. Crear usuarios

Registrar el `externalSubject` emitido por Cloudflare Access y asignar:

- Admin.
- RH.
- Supervisor por grupo.
- Comité.
- Operador por grupo.
- Trabajador vinculado a su expediente.
- Auditor.

### 8. Activar correo

1. Registrar dirección entrante en `/api/v1/email-channels`.
2. Apuntar Email Routing al Worker.
3. Verificar remitente `EMAIL_FROM`.
4. Probar entrada con audio, imagen y PDF.
5. Confirmar que únicamente se genere un borrador.
6. Probar convocatoria, asignación, resultado y cierre.

### 9. Conectar IA

1. Agregar `OPENAI_API_KEY` como secreto.
2. Configurar `OPENAI_MODEL` como variable.
3. Probar imagen y extracción estructurada.
4. Probar Workers AI para transcripción.
5. Confirmar revisión humana obligatoria.

### 10. Conectar ChatGPT o Claude

1. Desplegar el Worker MCP incluido en el workflow.
2. Configurar `MCP_SERVICE_TOKEN`.
3. Configurar `MCP_ORGANIZATION_ID`.
4. Conectar el endpoint `/mcp`.
5. Confirmar que todas las herramientas sean de solo lectura.

### 11. Aceptación de staging

Ejecutar todos los casos de `docs/operations/connection-checklist.md`, restaurar un respaldo y revisar `docs/verification/latest.md`.

### 12. Producción

Solo después de aprobación de responsables funcionales, técnicos y jurídicos, ejecutar `Deploy Certified Release` con el Environment `production`.
