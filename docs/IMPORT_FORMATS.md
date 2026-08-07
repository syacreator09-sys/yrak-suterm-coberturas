# Formatos de importación

## Personal

`POST /v1/import/employees`

```json
{"items":[{"employeeNumber":"1001","name":"Ana","email":"ana@example.com","groupId":"group-a","baseLevelId":"level-7","seniorityDate":"2018-01-01"}]}
```

La importación rechaza el lote si un `groupId` y `baseLevelId` no pertenecen a la misma organización/grupo.

## Datos que deben prepararse después

- Catálogo de grupos.
- Niveles por grupo.
- Transiciones autorizadas, por ejemplo 7→8.
- Personal y nivel base.
- Requisitos por nivel destino.
- Cumplimiento/vigencia por trabajador.
- Fila inicial de rotación por transición.
- Calendario laboral o turnos cuando aplique.
- Usuarios y roles.
