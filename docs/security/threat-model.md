# Modelo de amenazas

## Activos protegidos

- Identidad, nivel base, grupo, antigüedad y datos de contacto del personal.
- Cursos, certificaciones, evidencias y vigencias.
- Exámenes, calificaciones, revisiones y resultados.
- Orden de las filas de rotación.
- Asignaciones temporales y fechas reales de inicio y regreso.
- Audios, imágenes, documentos y correos originales.
- Eventos de auditoría, aprobaciones e inconformidades.
- Secretos de Cloudflare, OpenAI y MCP.

## Límites de confianza

1. Navegador → Cloudflare Access.
2. Access → Worker YRAK.
3. Worker → D1, R2, Queue, Durable Objects y Workflows.
4. Worker → proveedor de IA.
5. Email Routing → Worker de entrada.
6. ChatGPT/Claude → Worker MCP de solo lectura.
7. GitHub Actions → Cloudflare durante despliegue.

## Amenazas y controles

### Acceso horizontal o entre organizaciones

**Amenaza:** manipular IDs para consultar o modificar personas de otra organización o grupo.

**Controles:**

- Filtros por `organization_id` en consultas.
- Roles y grupos cargados desde D1 después de validar Access.
- Guardas adicionales para aprobaciones, cancelación y terminación.
- Triggers D1 de integridad cruzada en la migración `0013`.
- MCP limitado a una organización fija.

### Doble asignación

**Amenaza:** dos solicitudes simultáneas seleccionan a la misma persona.

**Controles:**

- Durable Object por grupo.
- Estados `RESERVED` y `ASSIGNED`.
- Idempotencia obligatoria en mutaciones críticas.
- Restricciones únicas y eventos de rotación.

### Alteración de calificaciones o ganador

**Amenaza:** editar directamente un resultado o hacer que la IA elija.

**Controles:**

- Calificaciones originales inmutables.
- Correcciones append-only y segundo aprobador.
- Ranking determinista.
- Agentes sin herramientas de escritura sobre resultados.
- Auditoría de actor, valor anterior, valor nuevo y motivo.

### Prompt injection en archivos

**Amenaza:** un audio, imagen, correo o PDF intenta ordenar al agente que asigne una plaza o ignore reglas.

**Controles:**

- Los adjuntos solo producen borradores.
- `reviewRequired` es obligatorio en el esquema del agente.
- La extracción no llama motores de asignación.
- El usuario confirma fechas, persona y motivo antes de crear expediente.
- Archivos originales y texto extraído se conservan separados.

### Archivo malicioso o suplantado

**Amenaza:** subir ejecutables con MIME falso o archivos excesivos.

**Controles:**

- Lista permitida de MIME.
- Validación de magic bytes.
- Límite de tamaño.
- R2 privado.
- SHA-256 por archivo.
- Los archivos nunca se ejecutan.

### Correo falso

**Amenaza:** correo externo intenta crear una asignación automática.

**Controles:**

- Dirección de entrada registrada por organización.
- Correo y adjuntos solo generan borradores.
- Revisión humana obligatoria.
- Asignaciones y concursos requieren API autenticada y aprobación.

### Fuga mediante MCP

**Amenaza:** un token MCP permite consultar otra organización o modificar datos.

**Controles:**

- Token de servicio separado.
- Hostname permitido.
- `MCP_ORGANIZATION_ID` fijo.
- Herramientas exclusivamente de lectura.
- Ninguna herramienta acepta SQL arbitrario.

### Fuga de secretos

**Amenaza:** claves confirmadas en Git o expuestas en logs.

**Controles:**

- Secretos mediante GitHub Environments y Wrangler secrets.
- Archivos generados y `.dev.vars` ignorados.
- Respuestas de error de producción no incluyen stack.
- OpenAI usa `store:false`.

### Borrado o reescritura del historial

**Amenaza:** eliminar pruebas de una decisión.

**Controles:**

- `audit_events`, `appeal_events` y revisiones son append-only mediante triggers.
- Correcciones generan eventos nuevos.
- Backups y restauraciones verificadas.

## Riesgos residuales antes de producción

- Aprobar formalmente días naturales, laborales o turnos.
- Aprobar criterios de desempate.
- Definir retención legal de documentos y datos personales.
- Validar dominio remitente y reglas antisuplantación.
- Confirmar políticas de Cloudflare Access y administradores.
- Ejecutar pruebas de penetración en staging.
- Revisar obligaciones laborales, sindicales y de protección de datos con responsables jurídicos.
