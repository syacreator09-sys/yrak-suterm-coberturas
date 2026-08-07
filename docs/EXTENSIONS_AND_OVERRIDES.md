# Extensiones y cambios posteriores al inicio

## Antes de existir asignación

`PATCH /v1/coverage-cases/:id/dates` recalcula:

- fechas contadas;
- días efectivos;
- modo de conteo;
- ROTATION vs COMPETITION.

Por tanto, un expediente aún no asignado puede pasar correctamente de 5 a 6 días y convertirse en concurso.

## Después de existir propuesta/asignación

El sistema **no cambia silenciosamente** de rotación a concurso después de haber seleccionado o iniciado una persona. La modificación de fechas se bloquea porque falta una regla oficial sobre qué hacer cuando una ausencia originalmente corta se extiende y cruza el umbral.

Ejemplo pendiente de norma:

- ausencia originalmente 1–5 días;
- trabajador ya subió temporalmente;
- posteriormente se confirma que la ausencia total será 6+.

No es seguro inferir si:

1. la persona continúa mientras se realiza concurso;
2. se mantiene toda la cobertura como rotación por haber iniciado así;
3. el concurso aplica sólo al periodo extendido;
4. debe terminar inmediatamente la cobertura corta;
5. existe otra regla contractual.

Hasta que CFE/SUTERM defina ese comportamiento, un responsable debe cerrar/cancelar el expediente según la realidad y registrar un expediente adicional conforme a la norma que finalmente se apruebe. Toda acción queda auditada.

Cuando la política oficial exista, debe añadirse como una regla versionada y una prueba de aceptación específica; no como lógica escondida en UI o prompts.
