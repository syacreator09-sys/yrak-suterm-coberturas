# Checklist de handoff

## Cloudflare

- [ ] Crear D1 `yrak-suterm-coberturas`.
- [ ] Reemplazar `REPLACE_WITH_D1_DATABASE_ID` en API, MCP y agentes.
- [ ] Crear R2 `yrak-suterm-evidence`.
- [ ] Crear Queue `yrak-notifications`.
- [ ] Desplegar Durable Object `GroupCoordinator`.
- [ ] Desplegar `CoverageWorkflow`.
- [ ] Habilitar binding Workers AI si se procesarán documentos/audio.
- [ ] Verificar remitente Email Service.
- [ ] Configurar Email Routing hacia el API Worker si se usará correo entrante.
- [ ] Configurar Cloudflare Access para API, panel y portal.

## Secrets

- [ ] `BOOTSTRAP_TOKEN` temporal para alta inicial.
- [ ] `MCP_API_TOKEN`.
- [ ] `AGENT_API_TOKEN`.
- [ ] `OPENAI_API_KEY` sólo si se elige OpenAI.
- [ ] `ANTHROPIC_API_KEY` sólo si se elige Anthropic.
- [ ] Nunca versionar secrets.

## Variables

- [ ] `INBOUND_EMAIL_ORGANIZATION_ID`.
- [ ] `MCP_ORGANIZATION_ID`.
- [ ] `AGENT_ORGANIZATION_ID`.
- [ ] `EMAIL_FROM`.
- [ ] Modelos externos explícitos si se usan.
- [ ] `VITE_API_BASE_URL` en panel y portal.

## Datos reales

- [ ] Organización.
- [ ] Grupos.
- [ ] Niveles.
- [ ] Transiciones autorizadas (ej. 7→8, 6→7).
- [ ] Personal y nivel base.
- [ ] Requisitos por nivel destino.
- [ ] Cumplimiento/vigencias por trabajador.
- [ ] Colas iniciales de rotación.
- [ ] Usuarios/roles/grupos.
- [ ] Calendario/turnos/feriados.
- [ ] Política por grupo.
- [ ] Regla de calificación mínima y desempate por concurso.

## Validación

- [ ] Instalar dependencias.
- [ ] Typecheck.
- [ ] Pruebas unitarias.
- [ ] Pruebas de aceptación.
- [ ] Dry-run de Worker.
- [ ] Migración limpia local.
- [ ] Smoke API.
- [ ] Staging.
- [ ] Pruebas de permisos.
- [ ] Pruebas de concurrencia.
- [ ] Pruebas de correo.
- [ ] Pruebas de audio/PDF/imagen.
- [ ] MCP sólo lectura.
- [ ] Agentes sin herramientas de decisión.
- [ ] Backup y restore real.

## Producción

No marcar producción como lista mientras exista alguna casilla crítica anterior sin evidencia de ejecución.
