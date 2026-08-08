# YRAK — Clone, Test & Connect Runbook

**Canonical release-candidate branch:** `ready/clone-test-connect-v2`  
**Do not merge to `main` until local + staging gates have fresh observed evidence.**

## 1. Clone

```bash
git clone https://github.com/syacreator09-sys/yrak-suterm-coberturas.git
cd yrak-suterm-coberturas
git switch ready/clone-test-connect-v2
```

Requirements: Node.js >=22, Git, Corepack/pnpm. The repo pins `pnpm@10.15.0`.

## 2. Bootstrap local workspace

```bash
bash scripts/bootstrap-local.sh
```

This installs dependencies and creates ignored local config files from examples when missing. A tracked/reviewed `pnpm-lock.yaml` is still required before calling a release reproducible.

## 3. Release-candidate gate

```bash
pnpm verify:rc
```

This is the static/compile/test/build gate for Admin, API, Agents, MCP, RAG, Employee Portal and Maintenance plus secret/migration/architecture checks and operational script syntax. Any failure blocks staging.

## 4. Shared local D1

All Workers use:

```text
.wrangler/state/yrak-local
```

Apply migrations:

```bash
bash scripts/migrate-local.sh
```

The historical numbering gap `0013` is documented in `migrations/sequence-exceptions.json`; do not renumber historical migrations. Current forward migrations include `0019` for notification processing recovery.

## 5. Start and seed local API

Terminal A:

```bash
pnpm dev:api
```

API: `http://127.0.0.1:8787`

Second terminal:

```bash
pnpm seed:local
```

Synthetic defaults are `admin@example.com` / `YRAK Local Test`. The seed refuses remote URLs and synchronizes the generated organization ID into ignored Agent/MCP `.dev.vars` files.

Bootstrap is fail-closed: production can never bootstrap; development requires loopback; staging requires explicit temporary enable + token.

## 6. Start remaining services

```bash
pnpm dev:agents       # 127.0.0.1:8788
pnpm dev:mcp          # 127.0.0.1:8789
pnpm dev:maintenance  # 127.0.0.1:8790 (optional for basic UI smoke)
pnpm dev:admin        # Vite prints URL, normally 5173
```

Use separate terminals. Maintenance is the sole scheduled-maintenance owner; API does not own a cron.

## 7. Read-only local smoke

```bash
DEV_USER_EMAIL=admin@example.com pnpm smoke:local
```

This checks health/readiness/auth-negative behavior and does not mutate labor state or invoke a model.

## 8. Claude Code project runtime

Project skills:

- `yrak-domain-guardrails`
- `yrak-verification`
- `yrak-cloudflare-staging`
- `yrak-mcp-readonly`
- `yrak-ai-router`
- `yrak-rag-connectors`

Project subagents:

- `yrak-auditor` — read-only, no Bash/Edit/Write;
- `yrak-code-reviewer` — read-only, no Bash/Edit/Write;
- `yrak-test-runner` — may execute verification commands, no edits/deploy;
- `yrak-cloudflare-integrator` — staging integration with normal permission prompts.

All use `model: inherit`; the repo does not pin a Claude model ID.

## 9. MCP

`.mcp.json` contains project-scoped `yrak-readonly` with environment expansion. Local defaults use:

```text
YRAK_MCP_URL=http://127.0.0.1:8789/mcp
YRAK_MCP_TOKEN=local-mcp-change-me
```

For staging, supply URL/token through shell/secret manager before launching Claude Code. MCP business tools are read-only; the only write is append-only `mcp_access_log`.

## 10. AI / Agent smoke

Local compatible provider example:

```text
AI_PROFILE=local
AI_COMPAT_PROVIDER_ID=ollama-local
AI_COMPAT_BASE_URL=http://127.0.0.1:11434/v1
AI_COMPAT_TEXT_MODEL=<installed-model>
```

Never expose Ollama `11434` publicly.

Standalone compatible-provider smoke:

```bash
AI_COMPAT_PROVIDER_ID=... \
AI_COMPAT_BASE_URL=... \
AI_COMPAT_TEXT_MODEL=... \
AI_COMPAT_API_KEY=... \
pnpm smoke:ai
```

Agent Worker path:

```bash
AGENT_API_TOKEN=local-agent-change-me pnpm smoke:agent
```

Agent history is bounded/minimized; raw intake text/extracted payloads are not persisted in session history and common PII fields are redacted from audit facts before model use.

## 11. RAG retrieval

Implemented:

- provider-agnostic RAG core;
- fail-closed org/group authorization boundary;
- active-document enforcement;
- reranker cannot introduce or replace canonical chunks;
- OpenAI-compatible `/embeddings` adapter;
- Supabase pgvector RPC retriever;
- dimension-safe Supabase schema renderer;
- `POST /v1/rag/search` for `ADMIN/HR/AUDITOR`;
- query audit stores SHA-256, not raw query text;
- Control Center manual search UI;
- `smoke:rag`.

D1 remains canonical for labor state; Supabase is knowledge sidecar only.

Choose the exact embeddings model/dimension, then:

```bash
RAG_EMBEDDING_DIMENSIONS=<exact-dimension> pnpm render:rag-schema
```

Review/apply the ignored `supabase/rag-schema.generated.sql` to the authorized Supabase project, then configure server-side only:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=<secret>
SUPABASE_RAG_RPC=yrak_match_chunks
RAG_EMBEDDING_BASE_URL=<https-endpoint-or-loopback>
RAG_EMBEDDING_MODEL=<exact-model>
RAG_EMBEDDING_API_KEY=<if-required>
RAG_REQUEST_TIMEOUT_MS=30000
```

Connection smoke:

```bash
DEV_USER_EMAIL=admin@example.com pnpm smoke:rag
```

After adding an authorized synthetic indexed document:

```bash
REQUIRE_RAG_RESULTS=YES DEV_USER_EMAIL=admin@example.com pnpm smoke:rag
```

Remaining RAG work after retrieval is verified: production ingestion/chunking/OCR jobs, optional reranker adapter and evaluations.

## 12. Gmail test connection

`smoke:gmail` verifies OAuth refresh without printing tokens/bodies. A send test is explicit and **self-send only** to `GMAIL_TEST_ADDRESS`.

OAuth-only:

```bash
GOOGLE_OAUTH_CLIENT_ID=... \
GOOGLE_OAUTH_CLIENT_SECRET=... \
GOOGLE_OAUTH_REFRESH_TOKEN=... \
pnpm smoke:gmail
```

Explicit self-send synthetic test:

```bash
CONFIRM_GMAIL_SEND_TEST=YES \
GMAIL_TEST_ADDRESS=<dedicated-test-mailbox> \
GOOGLE_OAUTH_CLIENT_ID=... \
GOOGLE_OAUTH_CLIENT_SECRET=... \
GOOGLE_OAUTH_REFRESH_TOKEN=... \
pnpm smoke:gmail
```

This is a connection smoke, not yet the production notification adapter used by YRAK.

## 13. Cloudflare staging configs

Do **not** edit tracked Wrangler files with real IDs. Generate ignored staging configs:

```bash
CONFIRM_YRAK_STAGING=YES \
YRAK_STAGING_D1_DATABASE_ID=... \
YRAK_STAGING_D1_DATABASE_NAME=... \
YRAK_STAGING_ORGANIZATION_ID=... \
YRAK_STAGING_ACCESS_TEAM_DOMAIN=<team>.cloudflareaccess.com \
YRAK_STAGING_ACCESS_AUD=... \
YRAK_STAGING_EMAIL_FROM=... \
YRAK_STAGING_R2_BUCKET=... \
YRAK_STAGING_QUEUE=... \
YRAK_STAGING_WORKFLOW=... \
pnpm render:cloudflare-staging
```

Then:

```bash
CONFIRM_YRAK_STAGING=YES pnpm preflight:staging
```

The preflight requires isolated `*-staging` Worker names, one shared D1/org/queue, Access values, no local `dev` block, no placeholders and no secret-bearing variables in the generated config.

### One-time staging bootstrap

Only for an empty authorized staging DB:

```bash
CONFIRM_YRAK_STAGING=YES CONFIRM_STAGING_BOOTSTRAP=YES pnpm staging:bootstrap:on
```

Run preflight with the explicit bootstrap window:

```bash
CONFIRM_YRAK_STAGING=YES \
CONFIRM_STAGING_BOOTSTRAP=YES \
ALLOW_STAGING_BOOTSTRAP=YES \
pnpm preflight:staging
```

After bootstrap, immediately:

```bash
CONFIRM_YRAK_STAGING=YES pnpm staging:bootstrap:off
CONFIRM_YRAK_STAGING=YES pnpm preflight:staging
```

Redeploy API and remove/rotate the temporary bootstrap secret.

## 14. Secrets

Canonical inventory: `docs/CONNECTIONS_CHECKLIST.md`.

Never put provider/database/OAuth/token secrets in Git, PRs, issues, screenshots, prompts or `VITE_*`. Use ignored local files and platform secret storage.

## 15. Promotion gate

Before `main`:

1. `pnpm verify:rc` passes on exact v2 head;
2. fresh local D1 migrations + seed + service smokes pass;
3. `pnpm-lock.yaml` is generated/reviewed/tracked and gate rerun;
4. Cloudflare staging config preflight passes;
5. staging D1/R2/Queue/DO/Workflow/Access/Workers are observed healthy;
6. anti-header-spoof test passes;
7. role matrix + org/group A/B isolation pass;
8. intake ownership, 1–5 rotation, 6+ competition, audit and CSV behavior pass;
9. notification duplicate/recovery behavior passes;
10. Agents + MCP + selected AI provider smokes pass;
11. RAG live smoke passes if enabled;
12. browser desktop/mobile fidelity + CSP pass;
13. backup/restore + rollback are observed;
14. final security/code review runs on exact promotion head.

**Prepared for clone/testing is not production-ready.** Production-ready requires the fresh evidence above.
