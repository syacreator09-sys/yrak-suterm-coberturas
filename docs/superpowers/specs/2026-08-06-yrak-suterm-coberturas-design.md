# YRAK SUTERM Coberturas — Diseño del sistema

**Fecha:** 2026-08-06  
**Estado:** Diseño base aprobado para planeación e implementación  
**Repositorio:** `syacreator09-sys/yrak-suterm-coberturas`

## 1. Objetivo

Construir una plataforma privada, auditable y desplegable en Cloudflare para administrar coberturas temporales de personal por grupos y niveles, con dos mecanismos:

1. **Coberturas de 1 a 5 días:** asignación por rotación, sin curso terminado, certificación ni examen de concurso.
2. **Coberturas de 6 días en adelante:** filtrado por requisitos registrados y concurso mediante examen.

El sistema conservará siempre el nivel base del trabajador. Una cobertura genera una asignación temporal; al concluir, el trabajador regresa automáticamente a su nivel base.

## 2. Reglas confirmadas

### 2.1 Niveles y sustitución

- Cada trabajador tiene un `nivel_base` permanente.
- Un trabajador del nivel inmediato inferior puede cubrir temporalmente el nivel superior.
- Ejemplo: una persona de nivel 7 puede cubrir una ausencia del nivel 8.
- El nivel base nunca se reemplaza ni se sobrescribe.
- La cobertura se representa mediante una asignación con fecha de inicio y fin.
- Al finalizar, la asignación se cierra y la persona vuelve a aparecer únicamente en su nivel base.
- El sistema puede registrar una cadena de coberturas cuando una sustitución genera otra necesidad en el nivel inferior.

### 2.2 Cobertura corta: 1 a 5 días inclusive

- No requiere curso terminado.
- No requiere certificación.
- No requiere examen habilitante.
- No requiere concurso.
- Participan candidatos activos, disponibles y pertenecientes al nivel inmediato inferior.
- La selección se realiza por una cola rotativa auditable.
- Quien completa una cobertura pasa al final de la cola correspondiente.
- Una cancelación antes de iniciar no consume turno.
- Una indisponibilidad justificada permite saltar al candidato sin marcarlo como cobertura realizada.
- Un rechazo voluntario puede consumir turno y mandar al candidato al final; esta política será configurable y quedará visible en la auditoría.

### 2.3 Cobertura larga: 6 días o más

- Se identifican candidatos del nivel inmediato inferior.
- La base de datos determina quién cumple los requisitos del nivel destino.
- Solamente los candidatos elegibles pueden concursar.
- Los elegibles presentan un examen de concurso.
- La clasificación se calcula con reglas deterministas.
- El ganador se asigna temporalmente al nivel superior.
- Al finalizar, regresa a su nivel base.
- Las reglas de desempate deben ser configurables y versionadas.

### 2.4 Auditoría

Toda decisión debe registrar:

- expediente y folio;
- regla aplicada y versión;
- candidatos considerados;
- candidatos excluidos y razón concreta;
- posición de la fila antes y después;
- resultado del examen;
- aprobaciones y correcciones;
- usuario, fecha y hora;
- valores anteriores y posteriores;
- archivos y comunicaciones relacionadas.

La auditoría no podrá borrarse ni editarse desde el panel ordinario.

## 3. Supuestos iniciales configurables

Los siguientes valores se implementarán como configuración y no quedarán incrustados en prompts:

```json
{
  "shortCoverageMaximumDays": 5,
  "longCoverageMinimumDays": 6,
  "dayCountingMode": "CALENDAR_DAYS",
  "sourceLevelOffset": 1,
  "cascadeEnabled": true,
  "voluntaryRejectionConsumesTurn": true,
  "cancelBeforeStartConsumesTurn": false,
  "humanApprovalRequired": true
}
```

El modo de conteo podrá cambiar posteriormente a días laborales o turnos sin rediseñar el dominio.

## 4. Alcance funcional

### 4.1 Administración

- organizaciones y centros;
- grupos de cobertura;
- niveles y relaciones entre niveles;
- trabajadores;
- estado laboral y disponibilidad;
- roles y permisos;
- reglas versionadas;
- catálogos configurables.

### 4.2 Requisitos

- cursos;
- certificaciones;
- exámenes habilitantes;
- documentos;
- experiencia u otros requisitos;
- vigencia;
- evidencia;
- validación por responsable;
- vista de cumplimiento y faltantes por persona y nivel.

### 4.3 Ausencias y coberturas

- registro manual o asistido desde correo, audio, imagen o documento;
- cálculo de duración;
- identificación de nivel vacante;
- selección del flujo corto o largo;
- cobertura directa o en cadena;
- reservas para evitar doble asignación;
- inicio, seguimiento, cierre y regreso automático;
- cancelaciones y sustituciones.

### 4.4 Rotación

- una cola independiente por grupo, nivel origen y nivel destino;
- estados disponible, reservado, asignado, no disponible y suspendido;
- historial inmutable de movimientos;
- vista de orden actual y explicación de saltos;
- simulador previo a confirmar una asignación.

### 4.5 Concursos

- convocatoria;
- padrón de elegibles;
- aceptación o declinación;
- examen;
- captura o importación de calificación;
- ranking;
- desempate;
- aprobación;
- publicación del resultado;
- inconformidad y corrección controlada.

### 4.6 Comunicaciones

- correo de solicitud incompleta;
- aviso de cobertura corta;
- convocatoria de concurso;
- recordatorios;
- aviso de no elegibilidad con razones;
- resultados;
- inicio y cierre de cobertura;
- regreso al nivel base;
- notificaciones internas de aprobación y conflicto.

### 4.7 Inteligencia documental

La IA podrá:

- transcribir audios;
- extraer datos de imágenes y documentos;
- clasificar solicitudes;
- proponer borradores de correos;
- explicar decisiones ya calculadas;
- responder consultas con acceso controlado.

La IA no podrá:

- alterar la fila;
- elegir libremente a un candidato;
- cambiar calificaciones;
- aprobar una asignación;
- inventar requisitos;
- sobrescribir reglas deterministas.

## 5. Arquitectura

### 5.1 Base tecnológica

Se utilizará Forja como chasis técnico derivado, conservando la atribución MIT, pero el dominio de coberturas se implementará como módulos independientes.

- **Cloudflare Workers + Hono:** API y rutas del panel.
- **D1:** fuente de verdad transaccional.
- **Durable Objects:** coordinación por grupo y bloqueo de rotaciones concurrentes.
- **Cloudflare Workflows:** procesos largos, espera de aprobaciones, examen y cierre programado.
- **R2:** evidencias, audios, imágenes, documentos y reportes.
- **Queues:** transcripción, extracción documental, correos y tareas asíncronas.
- **Vectorize:** reglamentos y base de conocimiento, sin usarla como fuente de decisiones.
- **Vercel AI SDK:** capa intercambiable para OpenAI, Anthropic o xAI.
- **TypeScript + Zod:** tipos y validación.
- **Vitest:** pruebas unitarias e integración.
- **Playwright:** pruebas end-to-end del panel.
- **GitHub Actions:** CI, auditoría de dependencias y despliegue controlado.

### 5.2 Componentes

```text
Canales y panel
      │
      ▼
API Worker / autenticación
      │
      ├── Intake Agent
      ├── Communication Agent
      ├── Audit Assistant
      │
      ▼
Servicios de dominio deterministas
      ├── CoveragePolicy
      ├── RotationEngine
      ├── EligibilityEngine
      ├── CompetitionEngine
      ├── AssignmentEngine
      ├── ReturnEngine
      └── AuditService
      │
      ├── D1
      ├── Durable Objects
      ├── Workflows
      ├── R2
      └── Queues
```

## 6. Estructura del repositorio

```text
yrak-suterm-coberturas/
├── apps/
│   ├── worker/                  # API, panel y webhooks
│   └── mcp/                     # interfaz opcional para ChatGPT/Claude
├── packages/
│   ├── domain/                  # entidades, tipos y políticas
│   ├── database/                # esquema D1 y repositorios
│   ├── rotation/                # cola y selección corta
│   ├── eligibility/             # requisitos y vigencias
│   ├── competition/             # examen, ranking y desempate
│   ├── assignments/             # cobertura temporal y regreso
│   ├── audit/                   # eventos inmutables
│   ├── agents/                  # IA limitada a interpretación/comunicación
│   ├── notifications/           # correo y plantillas
│   └── shared/                  # tipos y utilidades comunes
├── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   └── e2e/
├── docs/
├── scripts/
├── CLAUDE.md
├── AGENTS.md
├── wrangler.jsonc
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## 7. Modelo de datos mínimo

### Identidad y estructura

- `organizations`
- `sites`
- `groups`
- `levels`
- `level_transitions`
- `employees`
- `employee_group_memberships`
- `users`
- `roles`
- `user_roles`

### Requisitos

- `requirements`
- `level_requirements`
- `employee_requirement_records`
- `requirement_evidence`

### Coberturas

- `absences`
- `coverage_cases`
- `coverage_assignments`
- `coverage_chain_steps`
- `coverage_status_history`

### Rotación

- `rotation_pools`
- `rotation_queue_entries`
- `rotation_events`
- `availability_periods`

### Concursos

- `competitions`
- `competition_candidates`
- `exam_definitions`
- `exam_attempts`
- `competition_rankings`
- `appeals`

### Operación

- `approvals`
- `attachments`
- `notifications`
- `inbound_messages`
- `outbound_messages`
- `rule_versions`
- `audit_events`
- `idempotency_keys`

## 8. Agentes

### Intake Agent

Entrada: correo, texto, audio, imagen o documento.  
Salida: borrador estructurado validado con Zod.  
Restricción: no crea una cobertura activa sin confirmación o regla de automatización explícita.

### Communication Agent

Entrada: evento del dominio y plantilla.  
Salida: mensaje redactado dentro de campos permitidos.  
Restricción: no cambia fechas, personas, niveles, requisitos ni resultados.

### Audit Assistant

Entrada: pregunta autorizada.  
Salida: explicación sustentada por eventos, reglas y datos.  
Restricción: acceso de solo lectura y ocultamiento por rol.

### Support Agent

Entrada: pregunta operativa.  
Salida: guía y estado del expediente.  
Restricción: las operaciones de escritura requieren herramientas explícitas, validación y permisos.

## 9. Estados principales

### Expediente de cobertura

```text
DRAFT
PENDING_INFORMATION
PENDING_VALIDATION
READY_FOR_SELECTION
ROTATION_PROPOSED
COMPETITION_OPEN
EXAM_PENDING
RESULT_PENDING_APPROVAL
ASSIGNED
SCHEDULED
ACTIVE
COMPLETED
CANCELLED
DISPUTED
```

### Asignación temporal

```text
PROPOSED
RESERVED
APPROVED
SCHEDULED
ACTIVE
COMPLETED
CANCELLED
REPLACED
```

## 10. Seguridad y privacidad

- Repositorio privado.
- Secretos solamente mediante `wrangler secret put` o GitHub Secrets.
- Ninguna credencial en código, issues, documentación o chat.
- RBAC por organización, grupo y acción.
- Registros sensibles minimizados y protegidos.
- Archivos en R2 con claves no predecibles y acceso firmado.
- Validación de MIME, tamaño, hash y extensión.
- Protección CSRF, cookies seguras, rate limiting y cabeceras de seguridad.
- Idempotencia en webhooks y operaciones críticas.
- Registro append-only para auditoría.
- Exportación y respaldo documentados.
- Revisión de dependencias y análisis estático en CI.

## 11. Roles iniciales

- `SYSTEM_ADMIN`
- `HR_ADMIN`
- `SUPERVISOR`
- `EVALUATION_COMMITTEE`
- `OPERATOR`
- `EMPLOYEE`
- `AUDITOR`

Cada permiso será explícito; no se inferirá únicamente por la interfaz visible.

## 12. Criterios de aceptación globales

El sistema se considera funcional cuando puede demostrar, con pruebas automáticas y evidencia:

1. Crear grupos, niveles y trabajadores.
2. Registrar una ausencia de 1 a 5 días y seleccionar correctamente por rotación.
3. Mover al candidato al final solo cuando la política lo indique.
4. Registrar una ausencia de 6 días o más y excluir candidatos con razones precisas.
5. Capturar examen, producir ranking y resolver desempate configurado.
6. Crear una asignación temporal sin modificar el nivel base.
7. Bloquear dobles asignaciones concurrentes.
8. Cerrar la cobertura y regresar automáticamente al nivel base.
9. Mantener historial completo de fila, asignación, examen y aprobaciones.
10. Procesar un audio o imagen como borrador revisable.
11. Enviar correos mediante adaptador real o sandbox.
12. Probar roles y accesos.
13. Pasar pruebas unitarias, integración, contrato, E2E y auditoría de seguridad.
14. Desplegar staging reproducible en Cloudflare.
15. Dejar una lista final de conexiones externas que requieran intervención del propietario.

## 13. Fuera de alcance de la primera entrega

- integración directa con nómina sin API o especificación oficial;
- firma electrónica con validez jurídica específica;
- sustitución de reglamentos o decisiones sindicales;
- exámenes proctorizados con vigilancia biométrica;
- aplicación móvil nativa;
- decisiones autónomas de IA sobre elegibilidad o asignación.

## 14. Datos que se solicitarán al final para conexiones reales

- cuenta y permisos de Cloudflare;
- zona y dominio, si se utilizará dominio propio;
- proveedor de correo y remitente verificado;
- proveedor de IA y API key;
- credenciales o tokens de WhatsApp/Meta, si se conectará ese canal;
- lista real de grupos, niveles y trabajadores;
- catálogo de requisitos;
- regla oficial de desempate;
- usuarios iniciales y roles;
- política definitiva de días naturales, laborales o turnos.

La implementación utilizará adaptadores y datos de demostración para que estas conexiones puedan incorporarse al final sin reescribir el sistema.