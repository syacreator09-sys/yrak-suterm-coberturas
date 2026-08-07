# Escenario E2E local

Con API Worker en modo desarrollo, D1 migrado y administrador creado:

```bash
API_BASE_URL=http://127.0.0.1:8787 \
YRAK_TEST_EMAIL=admin@example.com \
python3 scripts/e2e_api.py
```

El script crea datos aislados con sufijo aleatorio y comprueba:

1. jerarquía 7→8;
2. tres candidatos nivel 7;
3. cola de rotación;
4. exactamente 5 días = `ROTATION`;
5. primero disponible seleccionado;
6. cierre corto mueve al seleccionado al final;
7. requisito obligatorio para nivel 8;
8. exactamente 6 días = `COMPETITION`;
9. elegibilidad;
10. aceptación del concurso;
11. reglas de examen;
12. calificaciones y ranking;
13. adjudicación al mayor examen;
14. cierre largo;
15. nivel base permanece 7.

El archivo es una prueba para ejecutar posteriormente; no existe resultado hasta que se corra.
