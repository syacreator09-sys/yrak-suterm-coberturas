# Modelo de una sola organización

Esta implementación está intencionalmente diseñada para **un despliegue YRAK SUTERM/CFE por base de datos**.

- `bootstrap` crea una sola organización.
- La migración `0014_single_organization_guard.sql` impide agregar una segunda organización.
- MCP, agentes y correo entrante se fijan explícitamente al mismo `organization_id`.
- Usuarios, grupos, niveles, empleados, coberturas, concursos y auditoría siguen almacenando `organization_id` para defensa en profundidad y trazabilidad.

Este diseño evita convertir el proyecto en un SaaS multi-tenant innecesario y reduce el riesgo de cruces de información laboral.

Si en el futuro se requiere alojar varias organizaciones independientes en la misma D1, deberá hacerse una revisión específica de multi-tenancy antes de retirar este guard. No basta con borrar el trigger.
