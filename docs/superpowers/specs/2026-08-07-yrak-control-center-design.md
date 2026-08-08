# YRAK Control Center — diseño funcional y técnico

Fecha: 2026-08-07
Estado: propuesta para aprobación antes de implementación
Rama de diseño: `design/control-center-v1`

## 1. Objetivo

Evolucionar `apps/admin-web` desde la consola funcional actual a un **YRAK Control Center** único para administración, RH, supervisión, auditoría, RAG, IA e infraestructura, sin crear un frontend paralelo ni cambiar las reglas laborales del dominio.

`apps/employee-portal` seguirá siendo la experiencia simplificada del trabajador. La autenticación/entrada podrá ser única y redirigir según rol, pero ambos frontends conservarán límites claros.

## 2. Contexto existente

El repositorio ya contiene:

- `apps/admin-web`: consola administrativa Vite + TypeScript.
- `apps/employee-portal`: portal de trabajador Vite + TypeScript.
- `apps/api-worker`: API operativa.
- `apps/agent-worker`: agentes IA sin autoridad laboral.
- `apps/mcp-worker`: integración read-only.
- `apps/maintenance-worker`: tareas de mantenimiento.

La consola actual ya permite operar personal, coberturas, concursos 6+, intake/documentos/IA, configuración, auditoría y reportes. El problema principal no es falta de funcionalidad base sino presentación, modularidad, navegación, observabilidad y conexión futura con RAG/infraestructura.

## 3. Alternativas consideradas

### A. Mantener la consola actual y sólo mejorar CSS

Ventaja: menor costo inmediato.

Desventaja: mantiene un `main.ts` monolítico, hace difícil añadir RAG/IA/infraestructura y aumenta el riesgo de regresiones visuales y funcionales.

**Descartada.**

### B. Reescribir el admin completo con React/Next.js

Ventaja: ecosistema UI amplio y mayor facilidad para dashboards complejos.

Desventaja: introduce un framework nuevo, retrasa la validación de la lógica existente y obliga a migrar de golpe una consola que ya funciona.

**No recomendada para v1.** Puede reevaluarse cuando el producto esté estabilizado.

### C. Evolución modular sobre Vite + TypeScript existente

Mantener Vite/TypeScript, dividir la UI en módulos/páginas/componentes y construir un design system ligero dentro del repo.

Ventajas:

- menor riesgo;
- conserva endpoints y lógica actual;
- no agrega dependencias grandes innecesarias;
- facilita una migración futura si realmente se necesita;
- permite construir Control Center, RAG y observabilidad por módulos.

**Opción seleccionada.**

## 4. Principios de producto

1. **Una sola fuente de verdad:** las decisiones laborales siguen en API/motores deterministas, nunca en UI o IA.
2. **Dashboard por rol:** la navegación y acciones visibles dependen del rol autenticado.
3. **Read-only por defecto en observabilidad:** RAG/IA/infraestructura muestran estado antes de ofrecer acciones.
4. **Acciones críticas con confirmación:** adjudicar, cancelar, cerrar, revisar calificaciones y operaciones equivalentes requieren confirmación explícita y feedback claro.
5. **No exponer secretos:** API keys/tokens nunca aparecen completos en el navegador.
6. **Datos sintéticos primero:** paneles de IA/RAG/infra se validan con datos de prueba antes de datos laborales reales.
7. **No duplicar paneles:** RAG, IA e infraestructura viven dentro del mismo Control Center.

## 5. Arquitectura de navegación

### Shell principal

- Sidebar colapsable en escritorio.
- Navegación inferior o drawer en móvil.
- Header superior con:
  - organización/grupo activo;
  - entorno `development|staging|production`;
  - usuario y rol;
  - estado global del sistema;
  - acceso a búsqueda rápida.

### Secciones

```text
YRAK CONTROL CENTER
├── Overview
├── Operación
│   ├── Coberturas
│   ├── Rotaciones 1–5
│   ├── Concursos 6+
│   ├── Personal
│   └── Requisitos
├── Documentos y RAG
│   ├── Documentos
│   ├── Ingestión
│   ├── Búsqueda RAG
│   ├── Fuentes / citas
│   └── Evaluaciones
├── IA y Agentes
│   ├── Agentes
│   ├── Proveedores / modelos
│   ├── Smoke tests
│   ├── Fallbacks
│   └── Telemetría
├── Infraestructura
│   ├── Cloudflare
│   ├── Supabase
│   ├── Upstash
│   ├── Modal
│   ├── NVIDIA
│   ├── Hugging Face
│   ├── Ollama
│   └── Gmail de pruebas
├── Auditoría
├── Reportes
└── Configuración
```

## 6. Dashboard Overview

La pantalla inicial debe responder en menos de unos segundos a: **¿qué está pasando y qué requiere atención?**

### KPIs operativos

- coberturas activas;
- coberturas programadas;
- coberturas pendientes de aprobación;
- concursos abiertos;
- revisiones de calificación pendientes;
- personal activo;
- alertas de requisitos/indisponibilidad.

### Panel de actividad

- últimas coberturas;
- próximas fechas relevantes;
- últimas acciones auditadas;
- errores recientes de integración.

### Salud del sistema

Estados resumidos:

```text
API          healthy/degraded/down
D1           healthy/degraded/down
R2           healthy/degraded/down
RAG          healthy/degraded/down
AI Router    healthy/degraded/down
Email        healthy/degraded/down
```

La salud es observacional. El dashboard no debe intentar reparar automáticamente producción.

## 7. Operación

### Coberturas

Reutilizar operaciones existentes, pero reemplazar formularios dispersos por:

- lista con filtros;
- búsqueda;
- estados visibles por badge;
- panel de detalle;
- timeline del expediente;
- acciones contextuales según estado y rol;
- preview antes de crear;
- confirmaciones explícitas para cancelar/cerrar/aprobar.

### Rotaciones 1–5

Pantalla dedicada para visualizar:

- cola por grupo/nivel;
- disponibilidad;
- última cobertura consumida;
- siguiente elegible calculado por el motor;
- motivo de exclusión cuando aplique;
- historial de movimientos.

La UI **muestra** la decisión del motor. No reimplementa la selección.

### Concursos 6+

Vista por concurso:

- requisitos;
- candidatos y elegibilidad;
- aceptación;
- calificaciones;
- revisiones pendientes;
- ranking calculado;
- aprobación/adjudicación humana;
- auditoría del proceso.

La IA no aparece como decisor del concurso.

### Personal y requisitos

- directorio;
- detalle del trabajador;
- nivel base claramente identificado como inmutable durante cobertura temporal;
- requisitos y vigencias;
- indisponibilidades;
- historial de coberturas.

## 8. Documentos y RAG

Esta sección se construirá para conectarse posteriormente con Supabase/pgvector, R2 y pipeline de ingestión.

### Documentos

Mostrar:

- título;
- tipo;
- versión;
- checksum;
- origen;
- vigencia;
- estado de indexación;
- número de chunks;
- clasificación/ACL;
- fecha de última ingestión.

### Ingestión

Pipeline visible:

```text
uploaded -> parsed -> chunked -> embedded -> indexed -> ready
```

Errores deben mostrar etapa y causa técnica sin exponer secretos.

### Búsqueda RAG

Herramienta interna de evaluación:

- pregunta;
- filtros de organización/grupo/tipo/vigencia;
- top-K recuperado;
- score;
- reranking;
- contexto final;
- respuesta del modelo;
- citas/fuentes.

Debe existir modo `debug RAG` sólo para perfiles autorizados y datos sintéticos/staging.

### Evaluación

- dataset sintético;
- preguntas esperadas;
- recall/precision aproximada de retrieval;
- calidad de citas;
- latencia;
- proveedor/modelo utilizado.

## 9. IA y Agentes

### Agentes

Mostrar los agentes existentes:

- Intake;
- Audit;
- Communication;
- Support.

Para cada uno:

- estado;
- proveedor/modelo actual;
- última ejecución;
- latencia;
- fallbacks;
- errores recientes;
- capacidades permitidas.

Debe mostrarse permanentemente la restricción de seguridad: **IA interpreta y comunica; el motor de reglas decide.**

### Proveedores y modelos

Panel para observar/configurar referencias no secretas:

- Workers AI;
- OpenAI-compatible genérico;
- NVIDIA NIM como preset;
- Ollama como preset local;
- OpenAI/Anthropic opcionales.

El navegador puede mostrar `configured/not configured`, ID de proveedor, modelo, base URL sanitizada y health. Nunca la API key.

### Smoke tests

Botón/acción sólo en entornos permitidos para ejecutar una prueba técnica con prompt sintético. Resultado:

- ok/error;
- proveedor;
- modelo;
- latencia;
- caracteres/tokens si están disponibles;
- fallback utilizado.

No se usa información laboral real.

## 10. Infraestructura

El Control Center no sustituye los dashboards oficiales de proveedores. Su función es dar una **vista unificada de salud y configuración**.

### Tarjetas de integración

Cada integración tendrá:

- estado: `not configured | healthy | degraded | down`;
- entorno;
- recurso esperado;
- último health check;
- latencia;
- última falla;
- enlace externo opcional al dashboard oficial;
- acciones seguras de test cuando existan.

Integraciones objetivo:

- Cloudflare;
- Supabase;
- Upstash;
- Modal;
- NVIDIA;
- Hugging Face;
- Ollama;
- Gmail de pruebas.

No se almacenan secrets en localStorage ni en código frontend.

## 11. Auditoría

Vista de eventos con:

- actor;
- rol;
- organización;
- entidad;
- acción;
- regla aplicada;
- razón;
- fecha/hora;
- correlation ID;
- enlace al expediente cuando aplique.

Los eventos son de sólo lectura desde esta pantalla.

## 12. Roles y navegación

Rol esperado -> acceso principal:

- `ADMIN`: Control Center completo.
- `HR`: operación, personal, concursos, reportes, auditoría relevante.
- `SUPERVISOR`: coberturas/grupo permitido.
- `COMMITTEE`: concursos y revisiones permitidas.
- `OPERATOR`: operación autorizada.
- `AUDITOR`: lectura, reportes y auditoría.
- `EMPLOYEE`: redirección al `employee-portal`.

La UI oculta funciones no permitidas, pero la seguridad real sigue estando en la API.

## 13. Entrada única

Diseño objetivo:

```text
/login
   ↓
autenticación
   ↓
API /me
   ↓
rol
   ├── EMPLOYEE -> employee-portal
   └── resto     -> admin-web / Control Center
```

En desarrollo se puede mantener temporalmente el header `x-yrak-user-email` para pruebas locales, pero producción no debe depender de él.

## 14. Diseño visual

Dirección visual: **enterprise operativo**, limpio, denso cuando haga falta, sin estética de landing page.

### Características

- fondo neutro;
- tarjetas blancas con bordes suaves;
- jerarquía tipográfica clara;
- estados por badge;
- tablas densas pero legibles;
- panel de detalle lateral o sección dedicada;
- confirmaciones para acciones críticas;
- responsive real para tablet/móvil;
- dark mode no es requisito de v1.

### Componentes base

- AppShell
- Sidebar
- Topbar
- Breadcrumbs
- StatCard
- StatusBadge
- HealthBadge
- DataTable
- FilterBar
- SearchInput
- EmptyState
- ErrorState
- LoadingState
- DetailPanel
- Timeline
- ConfirmDialog
- Toast
- FormField
- Tabs
- Code/JSON viewer para debugging autorizado

## 15. Modularización técnica

No mantener toda la UI en `src/main.ts`.

Estructura objetivo:

```text
apps/admin-web/src/
├── main.ts
├── app.ts
├── api/
│   ├── client.ts
│   └── types.ts
├── auth/
├── router/
├── layout/
├── components/
├── pages/
│   ├── overview/
│   ├── coverages/
│   ├── rotations/
│   ├── competitions/
│   ├── employees/
│   ├── requirements/
│   ├── documents/
│   ├── rag/
│   ├── agents/
│   ├── infrastructure/
│   ├── audit/
│   ├── reports/
│   └── settings/
├── state/
├── styles/
└── tests/
```

No introducir React/Next.js en esta fase salvo que una limitación real durante implementación lo justifique y se apruebe por separado.

## 16. Contratos API nuevos esperados

La UI operativa reutiliza los endpoints existentes. Para RAG/infra/health se podrán añadir endpoints read-only dedicados, por ejemplo:

```text
GET /v1/system/health
GET /v1/system/integrations
POST /v1/system/integrations/:id/test   # sólo staging/dev y roles autorizados
GET /v1/ai/status
POST /v1/ai/smoke-test                  # datos sintéticos
GET /v1/rag/documents
GET /v1/rag/health
POST /v1/rag/query                       # evaluación autorizada
GET /v1/rag/evaluations
```

Los nombres finales se ajustarán al contrato OpenAPI existente durante el plan de implementación.

## 17. Manejo de errores

- toda vista distingue `loading`, `empty`, `error`, `ready`;
- errores de API muestran correlation ID cuando exista;
- 401 -> login;
- 403 -> acceso denegado, sin esconder el error real;
- 409 -> conflicto operativo explicable;
- 429/5xx de IA -> mostrar provider/fallback cuando sea seguro;
- fallo de una integración no debe tumbar todo el dashboard;
- el dashboard nunca inventa un estado `healthy` si no pudo comprobarlo.

## 18. Seguridad

- sin secrets en frontend;
- sin localStorage para tokens sensibles;
- RBAC aplicado en API;
- Cloudflare Access/sesión segura en despliegue real;
- CSP y headers de seguridad;
- sanitización de contenido mostrado;
- acciones críticas protegidas contra doble envío;
- idempotency keys donde ya corresponda;
- IA/RAG no reciben contenido fuera del ACL del usuario.

## 19. Testing

### Unit

- navegación por rol;
- componentes de estado;
- formateo de estados;
- filtros;
- API error handling.

### Integration

- overview con respuestas simuladas;
- detalle de cobertura;
- flujo 1–5;
- flujo 6+;
- health integrations;
- smoke test IA con datos sintéticos;
- búsqueda RAG con fuentes sintéticas.

### E2E

- login/rol;
- crear/previsualizar cobertura;
- rotación corta;
- concurso largo;
- revisión de nota;
- auditoría;
- RAG debug en staging;
- health de integraciones;
- responsive básico.

No se declarará listo hasta ejecutar `pnpm typecheck`, `pnpm test`, `pnpm build` y E2E correspondientes.

## 20. Orden de construcción

1. Modularizar shell existente sin cambiar comportamiento.
2. Design system y navegación por rol.
3. Overview.
4. Operación: coberturas/rotaciones/concursos/personal/requisitos.
5. Auditoría/reportes/configuración.
6. System health e integraciones.
7. IA/agentes/smoke tests.
8. RAG/documentos/evaluaciones.
9. Entrada única y redirección employee portal.
10. Responsive, accesibilidad y hardening.
11. Staging con datos sintéticos.
12. E2E y correcciones antes de producción.

## 21. Criterios de aceptación

El Control Center v1 se considera completo cuando:

- sustituye funcionalmente la consola visual actual sin perder operaciones;
- el `main.ts` deja de concentrar todas las pantallas;
- cada rol sólo ve navegación y acciones apropiadas;
- las decisiones laborales siguen exclusivamente en motores/API;
- overview muestra estado operativo útil;
- IA y RAG pueden observarse/probarse sin datos reales;
- integraciones muestran salud sin exponer secrets;
- empleado se dirige al portal apropiado;
- errores parciales no rompen el dashboard completo;
- typecheck/tests/build/E2E pasan en staging;
- no se despliega producción hasta completar la matriz de pruebas del repositorio.

## 22. Fuera de alcance de v1

- reemplazar todos los dashboards oficiales de Cloudflare/Supabase/Modal/etc.;
- edición de secrets desde navegador;
- decisiones laborales autónomas por IA;
- chatbot general con acceso irrestricto;
- rediseño de la lógica 1–5/6+;
- migración a React/Next.js sin necesidad demostrada;
- billing/multitenancy comercial externo al alcance YRAK actual.

## 23. Resultado esperado

Un solo **YRAK Control Center** coherente, modular y auditable que opere el sistema actual y sirva como punto central de observación para RAG, agentes e infraestructura, manteniendo el portal del trabajador separado por seguridad y simplicidad.