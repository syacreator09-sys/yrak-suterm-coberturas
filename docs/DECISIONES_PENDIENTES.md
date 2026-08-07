# Decisiones pendientes configurables

No se inventan políticas laborales. El software distingue configuración técnica de regla oficial.

- **Conteo de días:** configurable `CALENDAR_DAYS`, `WORKING_DAYS` o `SHIFTS`.
- **Desempate y calificación mínima:** el concurso queda `rules_confirmed=0` hasta que un usuario autorizado capture y confirme ambos valores; no puede calcular ranking antes.
- **Rechazo voluntario en rotación:** campo de política `rejectionConsumesTurn`; falta fijar valor oficial por grupo.
- **Cancelación de rotación ya iniciada:** la API exige que el responsable indique expresamente si consume turno; no adivina.
- **Ausencia justificada y posición:** pendiente de norma oficial; el motor actualmente salta indisponibles sin moverlos al final.
- **Firma formal:** roles técnicos existen, pero el rol oficial que firma cada acto debe definirse con CFE/SUTERM.
- **Cascada:** soportada y configurable con `cascadeEnabled`; por defecto está desactivada hasta confirmar que ese grupo debe encadenar todos los huecos.
- **Vigencia:** cada requisito puede exigir vigencia al inicio o durante toda la cobertura.
