# Matriz de roles

| Acción                       | Admin |  RH | Supervisor |            Comité | Operador |            Trabajador | Auditor |
| ---------------------------- | ----: | --: | ---------: | ----------------: | -------: | --------------------: | ------: |
| Configurar organización      |    Sí |  Sí |         No |                No |       No |                    No | Lectura |
| Crear grupos y niveles       |    Sí |  Sí |         No |                No |       No |                    No | Lectura |
| Importar personal            |    Sí |  Sí |         No |                No |       No |                    No | Lectura |
| Registrar requisitos         |    Sí |  Sí |         No |                No |       No |                    No | Lectura |
| Crear ausencia/cobertura     |    Sí |  Sí |      Grupo |                No |    Grupo |                    No |      No |
| Aprobar rotación             |    Sí |  Sí |      Grupo |                Sí |       No |                    No | Lectura |
| Cancelar antes de iniciar    |    Sí |  Sí |      Grupo |                No |       No |                    No | Lectura |
| Terminar anticipadamente     |    Sí |  Sí |      Grupo |                No |       No |                    No | Lectura |
| Abrir concurso               |    Sí |  Sí |      Grupo |                No |    Grupo |                    No | Lectura |
| Aceptar participación        |    Sí |  Sí |         No |                No |       No |                Propia | Lectura |
| Registrar examen             |    Sí |  Sí |         No |                Sí |       No |                    No | Lectura |
| Solicitar corrección de nota |    Sí |  Sí |         No |                Sí |       No |                    No | Lectura |
| Aprobar corrección           |    Sí |  Sí |         No | Sí, segundo actor |       No |                    No | Lectura |
| Finalizar ranking            |    Sí |  Sí |         No |                Sí |       No |                    No | Lectura |
| Presentar inconformidad      |    Sí |  Sí |         No |                No |       No |                Propia | Lectura |
| Resolver inconformidad       |    Sí |  Sí |         No | Sí, segundo actor |       No |                    No | Lectura |
| Ver expediente               |    Sí |  Sí |      Grupo |                Sí |    Grupo |    Propio/relacionado |      Sí |
| Ver auditoría                |    Sí |  Sí |      Grupo |                Sí |       No | Propia cuando aplique |      Sí |
| Administrar usuarios         |    Sí |  No |         No |                No |       No |                    No | Lectura |
| Configurar correo/MCP        |    Sí |  No |         No |                No |       No |                    No | Lectura |

**Grupo** significa que la acción solo procede cuando `user_roles.group_id` contiene el grupo del expediente. La ausencia de grupos asignados nunca se interpreta como acceso global.

Los roles `ADMIN`, `HR`, `COMMITTEE` y `AUDITOR` son organizacionales. Los roles `SUPERVISOR` y `OPERATOR` deben asignarse por grupo.
