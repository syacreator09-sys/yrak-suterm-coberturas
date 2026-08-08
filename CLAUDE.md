# Instrucciones permanentes

Antes de modificar código lee, en este orden:

1. `AGENTS.md`
2. `docs/CLONE_TEST_CONNECT.md`
3. `docs/CONNECTIONS_CHECKLIST.md`
4. `docs/REGLAS_NEGOCIO.md`
5. `docs/DECISIONES_PENDIENTES.md`

Para pruebas/conexiones trabaja sobre `ready/clone-test-connect-v2` o una rama hija aislada. No promociones `main` por iniciativa propia.

El motor de reglas es determinista. Claude, ChatGPT y cualquier otro modelo se usan sólo para extracción, explicación, soporte y redacción. Nunca sustituyen la lógica de rotación, elegibilidad, ranking o aprobación.

Antes de introducir una nueva política laboral, agrégala primero a `docs/DECISIONES_PENDIENTES.md` o a la configuración versionada de reglas. No completes huecos de política con suposiciones.

## Skills del proyecto

Usa las skills de `.claude/skills/` cuando correspondan:

- `yrak-domain-guardrails`
- `yrak-verification`
- `yrak-cloudflare-staging`
- `yrak-mcp-readonly`
- `yrak-ai-router`
- `yrak-rag-connectors`

## Subagentes del proyecto

- `yrak-auditor`: revisión read-only de seguridad/dominio.
- `yrak-test-runner`: ejecución de evidencia; no edita.
- `yrak-code-reviewer`: revisión de diff; no edita.
- `yrak-cloudflare-integrator`: conexión staging con permisos normales; no promueve producción automáticamente.

Usan `model: inherit`: no hardcodees un modelo Claude en estos archivos sólo porque hoy esté disponible uno concreto.

## Evidencia obligatoria

No digas que algo está correcto, listo, probado o desplegado sin salida fresca del comando que lo demuestra. El gate local canónico es:

```bash
pnpm verify:rc
```

Después siguen migraciones, smoke/E2E y staging según `docs/CLONE_TEST_CONNECT.md`. Un build exitoso no prueba conexiones externas ni reglas de negocio end-to-end.

Antes de usar comandos de staging ejecuta siempre:

```bash
CONFIRM_YRAK_STAGING=YES pnpm preflight:staging
```

No habilites bootstrap de staging salvo la ventana inicial documentada, y desactívalo/redeploy inmediatamente después.

## Secretos

Nunca escribas API keys/tokens en archivos trackeados, `.mcp.json`, PRs, issues, logs o prompts. Usa `.dev.vars`/`.env.local` ignorados para local y el mecanismo de secretos del proveedor para staging/producción.

Nunca conviertas una clave server-side en `VITE_*`. `configured` no significa `healthy`; una integración externa requiere smoke observado en ese entorno.
