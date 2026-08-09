# YRAK E2E Final — Correo real, Agentes IA, Asistente con RAG acotado, Auditoría del Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el sistema YRAK funcionando end-to-end en producción: correo real de ofertas vía Gmail, los 4 agentes IA operativos con respuestas JSON limpias, asistente con memoria y RAG acotado en el dashboard, datos reales sembrados, y todo auditado y commiteado.

**Architecture:** Monorepo Cloudflare (Workers + D1 + R2 + Queues + DO + Workflows) ya desplegado. Se agrega: sender Gmail API (OAuth refresh token, HTTPS puro), hardening del agent-worker (límites de memoria/RAG, envelope `{success,data,error}`), proxy `/v1/assistant` en api-worker para no exponer el token de agentes al navegador, y panel Asistente en admin-web.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers/D1/DO, Vite (vanilla TS), NVIDIA NIM (`deepseek-ai/deepseek-v4-flash-0731`) vía proveedor `compatible`, Gmail API v1.

## Global Constraints

- Repo: `~/cano-ai-command-center/03-projects/yrak-suterm-coberturas`. Gates tras CADA tarea: `pnpm typecheck && pnpm test && pnpm build` en verde.
- Credenciales SOLO en `/private/tmp/claude-501/-Users-macpro-cano-ai-command-center-00-core-oh-my-claudecode/ff9c36b1-655e-44c5-be98-2e9ad084d23a/scratchpad/yrak-credenciales.md` (Cloudflare token/account id, NVIDIA key, Google OAuth client id/secret). NUNCA en el repo. Deploy: `export CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=...` en la sesión.
- La IA solo extrae/explica/redacta — NUNCA selecciona candidatos, aprueba, ni cambia niveles (regla dura del repo, `AGENTS.md`).
- Workers desplegados: api `yrak-suterm-coberturas-api`, agentes `yrak-suterm-agents`, mcp `yrak-suterm-mcp`, mantenimiento `yrak-suterm-maintenance`; Pages: `yrak-admin-web`, `yrak-employee-portal`. Org real: `suterm-cfe`. D1 id `bf353405-5422-4b9d-a11d-c8a8a813a4b6`.
- Auth de pruebas contra producción: headers `x-yrak-user-email: yrakelizalde9@gmail.com` + `x-yrak-dev-token: <DEV_AUTH_TOKEN del archivo de credenciales>`.
- Commits atómicos con trailers del repo (Constraint/Rejected/Confidence). Rama `build/connections-v1`, PR a main al final — nunca push directo a main.

---

### Task 1: Refresh token de Gmail (requiere 1 clic del usuario)

**Files:**
- Create: `scripts/gmail-oauth.mjs`

**Interfaces:**
- Produces: `GMAIL_REFRESH_TOKEN` (string `1//...`) guardado en el archivo de credenciales del scratchpad. Tasks 2 depende de él.

- [ ] **Step 1: Escribir el script de consentimiento OAuth**

```js
#!/usr/bin/env node
// scripts/gmail-oauth.mjs — corre en la Mac, NO en Workers. Uso:
//   GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node scripts/gmail-oauth.mjs
import http from 'node:http';

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
if (!clientId || !clientSecret) { console.error('Faltan GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET'); process.exit(2); }
const redirectUri = 'http://localhost:8790/oauth/callback';

const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
  scope: 'https://www.googleapis.com/auth/gmail.send',
  access_type: 'offline', prompt: 'consent',
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8790');
  if (url.pathname !== '/oauth/callback') { res.writeHead(404).end(); return; }
  const code = url.searchParams.get('code');
  if (!code) { res.writeHead(400).end('Sin code'); return; }
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  const json = await tokenResponse.json();
  if (!json.refresh_token) { res.writeHead(500).end('Sin refresh_token — reintenta con prompt=consent'); console.error(json); process.exit(1); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<h1>Listo</h1>Puedes cerrar esta ventana.');
  console.log('GMAIL_REFRESH_TOKEN=' + json.refresh_token);
  server.close(); process.exit(0);
});
server.listen(8790, () => console.log('Abre esta URL en tu navegador y aprueba con la cuenta Gmail:\n\n' + authUrl + '\n'));
```

- [ ] **Step 2: Correrlo y pedir al usuario el clic**

Run (con los valores del archivo de credenciales): `GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... node scripts/gmail-oauth.mjs`
Mostrar la URL al usuario en el chat y pedirle que la abra y apruebe con `yrakelizalde9@gmail.com`. **Si Google rechaza el redirect** ("redirect_uri_mismatch"): el OAuth client es tipo Web — guiar al usuario a agregar `http://localhost:8790/oauth/callback` en console.cloud.google.com → Credentials → ese client → Authorized redirect URIs, y reintentar.

- [ ] **Step 3: Guardar el token**

Anexar `GMAIL_REFRESH_TOKEN=...` y `GMAIL_SENDER=yrakelizalde9@gmail.com` al archivo de credenciales del scratchpad. No commitear el script con valores; el script se commitea limpio (lee de env).

- [ ] **Step 4: Commit**

```bash
git add scripts/gmail-oauth.mjs && git commit -m "feat: script de consentimiento OAuth para Gmail sender"
```

---

### Task 2: GmailEmailSender en api-worker (correo real con botones)

**Files:**
- Create: `apps/api-worker/src/services/gmail-email-service.ts`
- Modify: `apps/api-worker/src/env.ts` (AppEnv), `apps/api-worker/src/notification-consumer.ts`
- Test: `apps/api-worker/src/services/gmail-email-service.test.ts`

**Interfaces:**
- Consumes: `SendEmailLike` (ya definida en `env.ts`: `send({from,to,subject,text,html}) => Promise<{messageId?}>`), plantilla `ROTATION_OFFER` con `html` (ya existe en `packages/notifications/src/templates.ts`).
- Produces: `createGmailSender(env: AppEnv): SendEmailLike | undefined` y `resolveEmailSender(env: AppEnv): { sender: SendEmailLike; from: string } | undefined` usados por `notification-consumer.ts`.

- [ ] **Step 1: Test del builder MIME (falla primero)**

```ts
// apps/api-worker/src/services/gmail-email-service.test.ts
import { describe, expect, it } from 'vitest';
import { buildMimeMessage } from './gmail-email-service.js';

describe('buildMimeMessage', () => {
  it('genera multipart/alternative con subject UTF-8 y ambos cuerpos', () => {
    const raw = buildMimeMessage({ from: 'a@b.c', to: 'x@y.z', subject: 'Oferta – nivel 8', text: 'hola', html: '<b>hola</b>' });
    const decoded = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
    expect(decoded).toContain('To: x@y.z');
    expect(decoded).toContain('Content-Type: multipart/alternative');
    expect(decoded).toContain('=?UTF-8?B?');
    expect(decoded).toContain('<b>hola</b>');
  });
});
```

Run: `pnpm --filter @yrak/api-worker test` → FAIL (módulo no existe).

- [ ] **Step 2: Implementar el servicio**

```ts
// apps/api-worker/src/services/gmail-email-service.ts
import type { AppEnv, SendEmailLike } from '../env.js';

interface GmailConfig { clientId: string; clientSecret: string; refreshToken: string; sender: string }

function base64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeSubject(subject: string): string {
  const bytes = new TextEncoder().encode(subject);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

export function buildMimeMessage(message: { from: string; to: string; subject: string; text?: string; html?: string }): string {
  const boundary = 'yrak-' + crypto.randomUUID();
  const lines = [
    `From: ${message.from}`,
    `To: ${message.to}`,
    `Subject: ${encodeSubject(message.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    message.text ?? '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    message.html ?? `<pre>${message.text ?? ''}</pre>`,
    `--${boundary}--`,
  ];
  return base64Url(lines.join('\r\n'));
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(config: GmailConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId, client_secret: config.clientSecret,
      refresh_token: config.refreshToken, grant_type: 'refresh_token',
    }),
  });
  const json = await response.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !json.access_token) throw new Error(`GMAIL_TOKEN_ERROR:${json.error ?? response.status}`);
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

export class GmailEmailSender implements SendEmailLike {
  constructor(private readonly config: GmailConfig) {}
  async send(message: { from: string | { email: string; name?: string }; to: string | string[]; subject: string; text?: string; html?: string }): Promise<{ messageId?: string }> {
    const from = typeof message.from === 'string' ? message.from : message.from.email;
    const to = Array.isArray(message.to) ? message.to.join(', ') : message.to;
    const raw = buildMimeMessage({ from, to, subject: message.subject, ...(message.text !== undefined ? { text: message.text } : {}), ...(message.html !== undefined ? { html: message.html } : {}) });
    const token = await accessToken(this.config);
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    const json = await response.json() as { id?: string; error?: { message?: string } };
    if (!response.ok) throw new Error(`GMAIL_SEND_ERROR:${json.error?.message ?? response.status}`);
    return { ...(json.id ? { messageId: json.id } : {}) };
  }
}

export function resolveEmailSender(env: AppEnv): { sender: SendEmailLike; from: string } | undefined {
  if (env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN && env.GMAIL_SENDER) {
    return { sender: new GmailEmailSender({ clientId: env.GMAIL_CLIENT_ID, clientSecret: env.GMAIL_CLIENT_SECRET, refreshToken: env.GMAIL_REFRESH_TOKEN, sender: env.GMAIL_SENDER }), from: env.GMAIL_SENDER };
  }
  if (env.EMAIL && env.EMAIL_FROM && !env.EMAIL_FROM.startsWith('REPLACE_')) return { sender: env.EMAIL, from: env.EMAIL_FROM };
  return undefined;
}
```

- [ ] **Step 3: Extender AppEnv** — en `apps/api-worker/src/env.ts`, dentro de `AppEnv`, agregar junto a `EMAIL_FROM?`: `GMAIL_CLIENT_ID?:string;GMAIL_CLIENT_SECRET?:string;GMAIL_REFRESH_TOKEN?:string;GMAIL_SENDER?:string;`

- [ ] **Step 4: Usarlo en el consumidor** — en `apps/api-worker/src/notification-consumer.ts` reemplazar las líneas de envío:

```ts
// antes: if(!env.EMAIL||!env.EMAIL_FROM)throw new Error('EMAIL_NOT_CONFIGURED');
// y     : await env.EMAIL.send({from:env.EMAIL_FROM,...})
import { resolveEmailSender } from './services/gmail-email-service.js';
// dentro de processNotification:
const email = resolveEmailSender(env);
if (!email) throw new Error('EMAIL_NOT_CONFIGURED');
// ... y en el envío:
await email.sender.send({ from: email.from, to: row.recipient, subject: rendered.subject, text: rendered.text, ...(rendered.html ? { html: rendered.html } : {}) });
```

- [ ] **Step 5: Gates verdes** — `pnpm typecheck && pnpm test && pnpm build` (raíz).

- [ ] **Step 6: Secrets y deploy**

```bash
cd apps/api-worker
echo "<client_id>"      | pnpm exec wrangler secret put GMAIL_CLIENT_ID
echo "<client_secret>"  | pnpm exec wrangler secret put GMAIL_CLIENT_SECRET
echo "<refresh_token>"  | pnpm exec wrangler secret put GMAIL_REFRESH_TOKEN
echo "yrakelizalde9@gmail.com" | pnpm exec wrangler secret put GMAIL_SENDER
pnpm exec wrangler deploy
```
Duplicar los 4 valores en `.dev.vars` para local.

- [ ] **Step 7: Gate E2E de correo real (Evaluator fresco)** — contra PRODUCCIÓN con los headers de auth de pruebas: crear cobertura ROTATION → `POST /v1/coverage-cases/:id/rotation/select` → verificar `notifications.status='SENT'` vía `wrangler d1 execute --remote` → **pedir al usuario confirmar que llegó el correo a su Gmail con los 2 botones** → clic en Aceptar → verificar expediente `SCHEDULED`. Probar también Rechazar y reuso de token (debe decir "ya fue respondida").

- [ ] **Step 8: Commit** — `git add -A && git commit -m "feat: envío real de correo vía Gmail API con OAuth"`

---

### Task 3: IA de producción (NVIDIA/DeepSeek) en api-worker y agent-worker

**Files:**
- Modify: `apps/api-worker/wrangler.jsonc`, `apps/agent-worker/wrangler.jsonc`

- [ ] **Step 1: Vars** — en `vars` de api-worker: cambiar `"AI_PROVIDER":"workers-ai"` → `"AI_PROVIDER":"compatible"` y agregar `"AI_COMPAT_PROVIDER_ID":"nvidia-nim","AI_COMPAT_BASE_URL":"https://integrate.api.nvidia.com/v1","AI_COMPAT_TEXT_MODEL":"deepseek-ai/deepseek-v4-flash-0731"`. En agent-worker agregar las mismas 3 vars `AI_COMPAT_*` (su registry usa el compatible con fallback a workers-ai automáticamente).
- [ ] **Step 2: Secrets** — `echo "<nvidia_key>" | pnpm exec wrangler secret put AI_COMPAT_API_KEY` en AMBOS workers.
- [ ] **Step 3: Deploy ambos** y gate: `POST https://yrak-suterm-coberturas-api.../v1/intake/extract-text` con `{"content":"Solicito cobertura. Grupo: <grupo real>. Nivel objetivo: 8. Fecha inicio: 2026-10-10. Fecha fin: 2026-10-12. Motivo: vacaciones."}` → borrador con claves `group/targetLevel/startDate/endDate/reason` correctas.
- [ ] **Step 4: Commit** — `git commit -am "feat: NVIDIA NIM DeepSeek v4 como proveedor de IA en producción"`

---

### Task 4: Hardening del agent-worker — token, envelope limpio, memoria y RAG acotados

**Files:**
- Modify: `apps/agent-worker/src/session.ts`, `apps/agent-worker/src/index.ts`
- Test: `apps/agent-worker/src/session.test.ts` (nuevo)

**Interfaces:**
- Produces: respuestas HTTP con envelope `{ success: true, data: {...} }` / `{ success: false, error: { code, message } }`. Helper `clip(value: string, max: number): string` exportado desde `session.ts`. Task 5 consume el endpoint `POST /v1/support/:sessionId`.

- [ ] **Step 1: Test de límites (falla primero)**

```ts
// apps/agent-worker/src/session.test.ts
import { describe, expect, it } from 'vitest';
import { clip } from './session.js';

describe('clip', () => {
  it('recorta y marca truncado', () => {
    expect(clip('abc', 5)).toBe('abc');
    expect(clip('abcdefgh', 5)).toBe('abcde…[truncado]');
  });
});
```

Run: `pnpm --filter @yrak/agent-worker test` → FAIL.

- [ ] **Step 2: Límites en session.ts** — agregar y aplicar:

```ts
export const AGENT_LIMITS = {
  historyMessages: 10,        // mensajes de memoria enviados al modelo
  historyCharsPerMessage: 500,
  storedMessages: 50,         // memoria persistida máxima por sesión
  storedCharsPerMessage: 4000,
  ragPolicies: 5,             // políticas máximas inyectadas (RAG acotado)
  ragCharsPerPolicy: 1500,
  inputChars: 4000,           // input máximo del usuario
} as const;

export function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max) + '…[truncado]';
}
```

En `save()`: recortar `content` a `storedCharsPerMessage` y después de insertar, podar: `this.ctx.storage.sql.exec('DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY id DESC LIMIT ?)', AGENT_LIMITS.storedMessages);`
En `history()`: `LIMIT` = `historyMessages` y mapear `content: clip(content, historyCharsPerMessage)`.
En `run()`: al inicio, validar `JSON.stringify(input).length <= AGENT_LIMITS.inputChars` o lanzar `INPUT_TOO_LARGE`.

- [ ] **Step 3: RAG acotado en support** — reemplazar la consulta de políticas del agente support: aceptar `input.groupId` opcional; query `SELECT policy_key,version,config_json,effective_from FROM group_policies WHERE organization_id=? AND (group_id=? OR ? IS NULL OR group_id IS NULL) ORDER BY CASE WHEN group_id=? THEN 0 ELSE 1 END, effective_from DESC, version DESC LIMIT 5` con binds `(organizationId, groupId, groupId, groupId)`; mapear `config_json: clip(config_json, AGENT_LIMITS.ragCharsPerPolicy)`. En el prompt del system agregar: `'Responde en español, texto plano, sin markdown, máximo 150 palabras. Si la información no está en las políticas entregadas, di exactamente: "Esa política no está registrada; debe confirmarse oficialmente." No inventes datos.'`

- [ ] **Step 4: Envelope limpio en index.ts** — respuestas de éxito → `c.json({ success: true, data: { kind, sessionId, result } })`; agregar `app.onError((error, c) => c.json({ success: false, error: { code: error instanceof Error ? error.message.split(':')[0] : 'AGENT_ERROR', message: error instanceof Error ? error.message : 'error' } }, 400));` y 404/401 con el mismo formato.

- [ ] **Step 5: Gates verdes** (`pnpm typecheck && pnpm test && pnpm build`).

- [ ] **Step 6: Token + deploy**

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"   # guardar en archivo de credenciales como AGENT_API_TOKEN
cd apps/agent-worker
echo "<agent_api_token>" | pnpm exec wrangler secret put AGENT_API_TOKEN
pnpm exec wrangler deploy
```

- [ ] **Step 7: Gate de los 4 agentes contra producción** (Evaluator fresco, con `authorization: Bearer <AGENT_API_TOKEN>`):
  - `POST /v1/support/s1` `{"question":"¿Cuántos días aplican a rotación?"}` → `success:true`, respuesta en texto plano ≤150 palabras citando 1–5 días.
  - `POST /v1/support/s1` de nuevo con `{"question":"¿y qué te pregunté antes?"}` → demuestra memoria de sesión.
  - `POST /v1/intake/s2` `{"text":"Cobertura grupo A nivel 8 del 10 al 12 de octubre por vacaciones"}` → borrador estructurado.
  - `POST /v1/audit/s3` `{"entityType":"COVERAGE_CASE","entityId":"<id real de Task 2>"}` → hechos + explicación sin inventos.
  - `POST /v1/communication/s4` `{"coverageCaseId":"<id real>"}` → borrador con `requiresHumanSendApproval: true`.
  - Input gigante (>4000 chars) → `success:false, error.code:"INPUT_TOO_LARGE"`.

- [ ] **Step 8: Commit** — `git commit -am "feat: hardening agent-worker — envelope, límites de memoria y RAG acotado"`

---

### Task 5: Asistente IA en el dashboard (proxy seguro + panel de chat)

**Files:**
- Create: `apps/api-worker/src/routes/assistant.ts`
- Modify: `apps/api-worker/src/env.ts`, `apps/api-worker/src/index.ts`, `apps/api-worker/wrangler.jsonc`, `apps/admin-web/src/main.ts`

**Interfaces:**
- Consumes: endpoint del agent-worker de Task 4 (`POST {AGENT_WORKER_URL}/v1/support/{sessionId}` con Bearer `AGENT_API_TOKEN`, respuesta `{success,data:{result:{answer}}}`).
- Produces: `POST /v1/assistant` en api-worker: body `{question: string}` → `{success:true, data:{answer: string}}`. El navegador NUNCA ve `AGENT_API_TOKEN`.

- [ ] **Step 1: Ruta proxy**

```ts
// apps/api-worker/src/routes/assistant.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { AppBindings } from '../env.js';
import { requireRoles } from '../middleware.js';

export const assistantRoutes = new Hono<AppBindings>();
assistantRoutes.post('/', requireRoles('ADMIN','HR','SUPERVISOR','COMMITTEE','OPERATOR','EMPLOYEE','AUDITOR'),
  zValidator('json', z.object({ question: z.string().min(1).max(2000) })), async (c) => {
    const u = c.get('user');
    if (!c.env.AGENT_WORKER_URL || !c.env.AGENT_API_TOKEN) return c.json({ success: false, error: { code: 'ASSISTANT_NOT_CONFIGURED', message: 'Asistente no configurado' } }, 503);
    const sessionId = `user-${u.id}`.slice(0, 120);
    const response = await fetch(`${c.env.AGENT_WORKER_URL}/v1/support/${sessionId}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${c.env.AGENT_API_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ question: c.req.valid('json').question }),
    });
    const json = await response.json() as { success?: boolean; data?: { result?: { answer?: string } }; error?: { message?: string } };
    if (!response.ok || !json.success) return c.json({ success: false, error: { code: 'ASSISTANT_UPSTREAM', message: json.error?.message ?? `HTTP ${response.status}` } }, 502);
    return c.json({ success: true, data: { answer: json.data?.result?.answer ?? '' } });
  });
```

- [ ] **Step 2: Cablear** — `AppEnv` += `AGENT_WORKER_URL?:string;AGENT_API_TOKEN?:string;`. En `index.ts`: `import { assistantRoutes } from './routes/assistant.js';` + `app.route('/v1/assistant',assistantRoutes);`. En `wrangler.jsonc` vars: `"AGENT_WORKER_URL":"https://yrak-suterm-agents.yrak-suterm.workers.dev"`. Secret: `echo "<agent_api_token>" | pnpm exec wrangler secret put AGENT_API_TOKEN` (mismo valor de Task 4) y en `.dev.vars`.

- [ ] **Step 3: Panel en admin-web** — en `apps/admin-web/src/main.ts`: agregar `['assistant','Asistente IA']` a la lista del sidebar, y la vista:

```ts
async function assistant(){view.innerHTML=`<h2>Asistente IA</h2><div class="panel"><div id="chat-log" style="max-height:380px;overflow-y:auto;margin-bottom:12px"></div><form id="ask"><label>Pregunta sobre reglas y políticas</label><input name="question" maxlength="2000" required placeholder="¿Cuántos días aplican a rotación?"><button class="primary">Preguntar</button></form><p class="muted">El asistente solo explica reglas y políticas registradas. Nunca decide ni aprueba.</p></div>`;const log=document.querySelector<HTMLDivElement>('#chat-log')!;const esc=(s:string)=>s.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));document.querySelector<HTMLFormElement>('#ask')!.onsubmit=async e=>{e.preventDefault();const form=e.currentTarget as HTMLFormElement;const q=String(new FormData(form).get('question'));log.insertAdjacentHTML('beforeend',`<p><strong>Tú:</strong> ${esc(q)}</p>`);form.reset();try{const r=await api('/v1/assistant',{method:'POST',body:JSON.stringify({question:q})});log.insertAdjacentHTML('beforeend',`<p><strong>Asistente:</strong> ${esc(r.data.answer)}</p>`);}catch(err){log.insertAdjacentHTML('beforeend',`<p style="color:#b91c1c">Error: ${esc(String(err))}</p>`);}log.scrollTop=log.scrollHeight;};}
```
Registrarla en el router de vistas junto a las demás (`assistant`), siguiendo el patrón existente de `data-view`.

- [ ] **Step 4: Gates + deploy** — gates verdes; `wrangler deploy` api-worker; rebuild admin-web (`pnpm build`) y `wrangler pages deploy dist --project-name=yrak-admin-web --branch=main --commit-dirty=true`.
- [ ] **Step 5: Gate visual (Evaluator)** — en navegador (local con dev-auth): abrir Asistente, preguntar "¿cuántos días aplican a rotación?" → respuesta limpia en texto plano; repregunta demuestra memoria; pregunta por política inexistente → responde la frase de "debe confirmarse oficialmente" sin inventar.
- [ ] **Step 6: Commit** — `git commit -am "feat: asistente IA en dashboard vía proxy seguro"`

---

### Task 6: Datos reales de producción + selector de sesión + selects amigables + escape HTML

**Files:**
- Modify: `apps/employee-portal/src/main.ts`, `apps/admin-web/src/api.ts`, `apps/admin-web/src/main.ts`
- Create: `scripts/seed-production.sh`

- [ ] **Step 1: Sembrar catálogo real vía API de producción** (no SQL directo) — script `scripts/seed-production.sh` con curls idempotentes usando los headers de auth de pruebas: crear grupo "Grupo A" (`POST /v1/config/groups`), niveles 5–8 con `rank_order` (`POST /v1/config/groups/:id/levels`), transiciones 7→8, 6→7, 5→6 (`POST /v1/config/transitions` — verificar ruta exacta en `apps/api-worker/src/routes/configuration.ts` antes de escribir el script), pool de rotación 7→8, 3 empleados con email `yrakelizalde9@gmail.com` (para que TODAS las ofertas lleguen al buzón del usuario durante el piloto), entradas de cola, usuarios EMPLOYEE. Ejecutarlo y verificar con `GET /v1/employees`.
- [ ] **Step 2: Selector de sesión de desarrollo** — en ambos SPAs: si no hay `VITE_DEV_USER_EMAIL`, leer `localStorage.yrakDevEmail` y `localStorage.yrakDevToken`; si faltan, mostrar un formulario simple (correo + token) que los guarde y recargue. Enviar siempre como headers. Así el usuario entra a las Pages públicas con su correo + DEV_AUTH_TOKEN sin rebuild.
- [ ] **Step 3: Selects amigables** — en admin-web reemplazar los `<input name="employeeId">` de los paneles Personal/Concursos por `<select>` poblado de `GET /v1/employees` (patrón grupo→nivel ya existente con `options()`).
- [ ] **Step 4: Escape HTML** — agregar `escapeHtml` util compartido en cada SPA y aplicarlo a todo campo de texto libre interpolado (nombres, motivos, razones). (Cierra la tarea de XSS pendiente.)
- [ ] **Step 5: Gates + redeploy de ambas Pages.** Gate E2E (Evaluator, navegador contra producción): entrar como Secretario → declarar cobertura → oferta → correo real → aceptar desde el correo → dashboard muestra SCHEDULED; portal del trabajador muestra su cobertura; un EMPLOYEE no ve datos de otro.
- [ ] **Step 6: Commit** — `git commit -am "feat: seed producción, selector de sesión y saneamiento HTML"`

---

### Task 7: Auditoría final + TEST_MATRIX + backup/restore + cierre de repo

**Files:**
- Modify: `docs/CONNECTIONS.md`, `docs/DEPLOYMENT.md`, `docs/DECISIONES_PENDIENTES.md`, `README.md`
- Create: `docs/RELEASE_CANDIDATE.md` (actualizar), `docs/RUNBOOK_AAH.md`

- [ ] **Step 1: TEST_MATRIX** — ejecutar contra producción todos los casos de `docs/TEST_MATRIX.md` aplicables sin dominio (rotación, concurso 6+, cascada, permisos por rol, idempotencia). Registrar resultado por caso (PASA/FALLA/NO APLICA + evidencia) en `docs/RELEASE_CANDIDATE.md`.
- [ ] **Step 2: Backup/restore** — correr `scripts/backup-d1.sh` y `scripts/backup-r2.sh` contra los recursos reales (leerlos primero; ajustar ids si usan placeholders); verificar que el dump D1 restaura en una base local limpia.
- [ ] **Step 3: Auditoría de seguridad rápida (Evaluator security)** — checklist: sin secretos en el repo (`git grep -iE 'nvapi-|GOCSPX|cfat_|sk-ant'` limpio), endpoints `/offers` no filtran datos sin token válido, CORS restringido a los orígenes listados, empleado no puede actuar sobre ofertas ajenas (repetir la prueba 400), envelope de errores no filtra stack traces.
- [ ] **Step 4: Docs** — actualizar los 4 docs con el estado real (URLs, recursos, flujo de correo Gmail, agentes, límites del asistente, pendientes bloqueados: Access+dominio, ANTHROPIC_API_KEY→switch de 1 paso, correo entrante, rotación del token Cloudflare de cuenta completa a uno acotado ANTES de producción real — recordarlo explícitamente al usuario).
- [ ] **Step 5: PR** — rama `build/connections-v1`, commits ya atómicos, push, `gh pr create` a main con resumen completo y test plan. NO merge sin aprobación del usuario.
- [ ] **Step 6: Reporte final al usuario** — qué cambió, qué se verificó (con evidencia), riesgos residuales y los 4 pendientes bloqueados.

---

## Self-Review (hecho)

- Cobertura: correo ✔ (T1–T2), agentes todos ✔ (T4), asistente con memoria+RAG+límites ✔ (T4–T5), JSON/strings limpios ✔ (T4 envelope + T5), dashboard probado y auditado ✔ (T5–T7), datos reales ✔ (T6).
- Tipos consistentes: `SendEmailLike` reusada; envelope `{success,data,error}` idéntico en agent-worker y proxy; `clip`/`AGENT_LIMITS` definidos donde se usan.
- Sin placeholders: todo código real; el único punto abierto marcado explícitamente es verificar la ruta exacta de transiciones en `configuration.ts` antes de escribir el seed (instrucción de verificación, no un TBD de diseño).
