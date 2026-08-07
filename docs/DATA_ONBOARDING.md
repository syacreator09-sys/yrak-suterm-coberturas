# Onboarding de datos CFE/SUTERM

No cargar datos reales hasta haber migrado D1 y creado la organización inicial.

## Orden

1. **Bootstrap** de organización/admin.
2. **Catálogo**: grupos, niveles y transiciones autorizadas.
3. **Personal**: número, nombre, correo, grupo, nivel base, antigüedad.
4. **Requisitos**: curso/certificación/examen previo/documento/etc.
5. **Mapeo requisito → nivel destino** mediante el panel avanzado o API.
6. **Cumplimiento individual** y vigencias.
7. **Usuarios y roles**.
8. **Colas de rotación**, respetando el orden inicial oficial.
9. **Feriados/turnos** si el conteo no es natural.
10. **Política por grupo**: conteo, rechazo, cascada.

## Reglas de carga

- El nivel base del empleado es el titular; nunca cargar una cobertura actual como si fuera nivel base.
- Las transiciones deben ser explícitas, por ejemplo `7→8`; el software no deduce jerarquía restando números.
- Para concursos 6+ debe existir al menos un requisito obligatorio asociado al nivel destino.
- Las colas se crean por combinación grupo + nivel origen + nivel destino.
- No cargar resultados de examen como requisitos si corresponden al concurso actual; esos resultados pertenecen a `competition_candidates`.

## Validación posterior

Tomar una muestra por grupo y comprobar manualmente:

- nivel base;
- transición inmediata inferior;
- orden de cola;
- requisitos/vigencias;
- usuario/rol;
- cálculo de días.

Usar datos demo primero y reemplazarlos únicamente después de pasar staging.
