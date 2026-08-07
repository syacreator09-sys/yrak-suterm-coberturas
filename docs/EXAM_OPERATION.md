# Operación del examen de concurso

YRAK administra el **proceso de concurso** y conserva el resultado oficial del examen, pero no inventa un mecanismo de aplicación de examen que CFE/SUTERM no haya definido.

## Lo que ya hace el sistema

1. Determina que una cobertura de 6+ días requiere concurso.
2. Valida requisitos obligatorios del nivel destino.
3. Publica/gestiona candidatos elegibles.
4. Registra aceptación o no participación.
5. Obliga a confirmar calificación mínima y regla de desempate antes de rankear.
6. Captura la primera calificación del examen.
7. Conserva correcciones posteriores como revisiones separadas.
8. Exige un segundo usuario para aprobar una corrección de calificación.
9. Calcula ranking determinista por examen y luego desempate configurado.
10. Bloquea adjudicación si hay revisión pendiente, inconformidad abierta o el ganador ya no está disponible.
11. Registra aprobación/adjudicación y auditoría.

## Cómo entra la calificación

Actualmente la calificación autorizada puede ser capturada desde la consola/API por Comité, HR o Admin. Esto permite integrar después cualquiera de estas fuentes sin cambiar el motor de concurso:

- examen presencial CFE/SUTERM;
- plataforma institucional existente;
- archivo de resultados validado;
- proveedor externo autorizado.

El identificador del candidato, la calificación, el actor y cualquier revisión quedan trazables.

## Aplicación de examen en línea

No se construyó un banco de preguntas ni un proctoring propio porque todavía no existe una especificación oficial de:

- contenido/preguntas;
- número de reactivos;
- tiempo límite;
- intentos;
- aleatorización;
- identidad/proctoring;
- criterio de aprobación;
- firma del resultado.

Agregar esas reglas sin la norma oficial alteraría el proceso laboral. Si CFE/SUTERM entrega dicha especificación, puede incorporarse como un módulo `exam-provider` sin modificar rotación, elegibilidad, ranking ni auditoría.
