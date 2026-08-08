# YRAK — Clone, Test & Connect Runbook

**Release-candidate branch:** `ready/clone-test-connect-v1`  
**Do not merge to `main` until the full local + staging gates have observed evidence.**

This guide is the canonical execution order for a fresh machine.

## 1. Clone the isolated branch

```bash
git clone https://github.com/syacreator09-sys/yrak-suterm-coberturas.git
cd yrak-suterm-coberturas
git switch ready/clone-test-connect-v1
```

For a private repository, authenticate Git/GitHub first using your normal credential flow. Do not put a PAT in a command that will be saved to shell history.

Required runtime:

- Node.js >=22
- Corepack/pnpm (repo pins `pnpm@10.15.0`)
- Git

## 2. Bootstrap local files/dependencies

```bash
bash scripts/bootstrap-local.sh
```

This:

- runs the environment doctor;
- installs workspace dependencies;
- creates ignored `.dev.vars` / `.env.local` files from safe examples only when missing;
- reruns the doctor in strict mode.

The first install currently generates `pnpm-lock.yaml` because a lockfile is not yet tracked. Review it and commit it only after the full gate succeeds. A release candidate without a reviewed lockfile is not reproducible enough for production.

## 3. Static release-candidate gate

```bash
pnpm verify:rc
```

The gate checks:

- environment/required files;
- migration numbering;
- tracked secret patterns;
- typecheck + tests + dry-run build for Admin, API, Agents, MCP, Employee Portal and Maintenance;
- root Turbo typecheck/test/build;
- operational Node script syntax.

If any step fails, fix that failure and rerun. Do not skip it to continue to staging.

## 4. Apply local D1 migrations

All Workers use a shared local Cloudflare persistence directory:

```text
.wrangler/state/yrak-local
```

Apply migrations to that same state:

```bash
bash scripts/migrate-local.sh
```

Then keep the same `pnpm dev:*` commands below; each Worker already includes the same `--persist-to` path.

If `scripts/check-migrations.mjs` reports a numeric gap, stop and inspect migration history. Never renumber an already-applied migration just to make the checker green.

## 5. Start API and create synthetic local organization

Terminal A:

```bash
pnpm dev:api
```

The API is fixed to:

```text
http://127.0.0.1:8787
```

In a second terminal:

```bash
node scripts/seed-local.mjs
```

Defaults are local synthetic values:

- admin: `admin@example.com`
- organization: `YRAK Local Test`
- bootstrap token: `local-change-me`

The script refuses remote URLs. It synchronizes the generated local organization ID into the ignored Agent/MCP `.dev.vars` files.

## 6. Start the remaining local services

Terminal B:

```bash
pnpm dev:agents
```

Agents: `http://127.0.0.1:8788`

Terminal C:

```bash
pnpm dev:mcp
```

MCP: `http://127.0.0.1:8789`

Terminal D:

```bash
pnpm dev:admin
```

Vite will print the local Control Center URL (normally port 5173). The Admin frontend proxies `/v1`, `/health`, `/ready` and `/bootstrap` to API `8787`.

Maintenance is optional during UI/API smoke:

```bash
pnpm dev:maintenance
```

Maintenance: `http://127.0.0.1:8790`

## 7. Run read-only connection smoke

With API/Agents/MCP running:

```bash
DEV_USER_EMAIL=admin@example.com pnpm smoke:local
```

This performs only read/health/auth-negative checks. It does not create a coverage, change a queue, rank a candidate, approve an assignment or invoke an AI model.

Expected services:

| Service | Local port | Public check |
|---|---:|---|
| API | 8787 | `/health`, `/ready` |
| Agents | 8788 | `/health`, `/ready` |
| MCP | 8789 | `/health`, `/ready` |
| Admin | Vite | browser UI |
| Maintenance | 8790 | optional during UI smoke |

## 8. Claude Code project skills/subagents

Project skills live under `.claude/skills/`:

- `yrak-domain-guardrails`
- `yrak-verification`
- `yrak-cloudflare-staging`
- `yrak-mcp-readonly`
- `yrak-ai-router`
- `yrak-rag-connectors`

Project subagents live under `.claude/agents/`:

- `yrak-auditor` — read-only audit;
- `yrak-test-runner` — evidence-only test execution;
- `yrak-code-reviewer` — read-only merge review;
- `yrak-cloudflare-integrator` — staging integrator with normal permission prompts.

Use `inherit` model selection so the project does not depend on a hard-coded Claude model ID.

After adding/updating agent files during an active Claude Code session, reload/restart the session if needed so project agents are rediscovered.

## 9. Claude Code MCP

The repository contains project-scoped `.mcp.json` for `yrak-readonly`.

Local defaults:

```text
YRAK_MCP_URL=http://127.0.0.1:8789/mcp
YRAK_MCP_TOKEN=local-mcp-change-me
```

The values in `.mcp.json` use environment expansion; no real token is committed. For staging, export the real staging URL/token in your shell/secret manager before starting Claude Code:

```bash
export YRAK_MCP_URL='https://<staging-mcp-host>/mcp'
export YRAK_MCP_TOKEN='<secret-from-your-secret-manager>'
claude
```

Then use `/mcp` or `claude mcp get yrak-readonly` to inspect the connection. The MCP server remains read-only by contract.

## 10. Agent model test

Cloudflare Workers AI does not have a purely local simulator. For a no-cloud test, use a local OpenAI-compatible provider such as Ollama in the ignored Agent `.dev.vars`:

```text
AI_PROFILE=local
AI_COMPAT_PROVIDER_ID=ollama-local
AI_COMPAT_BASE_URL=http://127.0.0.1:11434/v1
AI_COMPAT_TEXT_MODEL=<installed-local-model>
```

Do not expose Ollama port `11434` publicly.

For NVIDIA NIM or another compatible provider, set the compatible provider URL/model and key only in ignored/deployment secrets. Verify the provider's current model catalog rather than copying a model ID from old docs.

The standalone fixed-prompt provider smoke is:

```bash
AI_COMPAT_PROVIDER_ID=... \
AI_COMPAT_BASE_URL=... \
AI_COMPAT_TEXT_MODEL=... \
AI_COMPAT_API_KEY=... \
pnpm smoke:ai
```

This proves model connectivity only, not labor/business correctness.

## 11. RAG status

`packages/rag` contains the provider-agnostic security core:

- Retriever/Reranker/Embedding/DocumentStore ports;
- organization/group access filters passed into retrieval;
- fail-closed validation if an adapter returns unauthorized chunks;
- bounded top-K;
- citation metadata.

Actual Supabase pgvector / Modal / Hugging Face adapters are intentionally **not faked**. Connect them only after their accounts/schema/endpoints exist and add adapter-specific integration tests.

D1 remains canonical for coverage/rotation/competition/assignment state. Supabase must not become a second source of truth for those tables.

## 12. External account connection matrix

| Integration | What is ready in code | What must be supplied/tested |
|---|---|---|
| Cloudflare | Workers configs, D1/R2/Queue/DO/Workflow bindings, Access JWT verifier | account auth, real resource IDs, staging Access team domain/audience, secrets, deploy smoke |
| Supabase | RAG port/boundary + server env placeholder | project, pgvector schema/RPC/adapter, server credential, retrieval tests |
| Modal | server env placeholder + RAG compute port concept | endpoint/function contract, auth, synthetic job smoke |
| Upstash | server env placeholder; optional cache | REST URL/token + adapter only if measured need exists |
| NVIDIA | generic OpenAI-compatible provider already supported | API key + current compatible model ID + synthetic smoke |
| Hugging Face | server token placeholder / RAG model role | token + selected model/artifact workflow + adapter/job test |
| Ollama | generic OpenAI-compatible provider | local install/model; no key by default |
| Gmail test | mailbox identity placeholder | Google OAuth/Gmail adapter and consent flow; not implemented yet |

Never paste real secrets into chat, source code, GitHub issues, PR descriptions or screenshots.

## 13. Staging gate

Only after local gates pass:

1. authenticate Wrangler to the intended Cloudflare account;
2. provision/resolve staging resources;
3. replace `REPLACE_WITH_*` values for the staging deployment configuration only;
4. set secrets using platform secret storage;
5. deploy API first;
6. configure Cloudflare Access and verify signed JWT auth;
7. deploy Agents, MCP and Maintenance;
8. deploy Control Center/Employee Portal behind Access;
9. run anti-header-spoof, role matrix, group-scope A/B, intake ownership, rotation 1–5, competition 6+, audit, backup/restore and provider smoke tests;
10. compare the real browser render against the approved Control Center mockup;
11. only then consider production promotion.

## Definition of clone-ready vs production-ready

**Clone-ready** means the repository contains the code, safe examples, skills/agents, deterministic local ports/state path and verification scripts needed to begin observed testing.

**Production-ready** requires fresh successful outputs from the full local and staging gates plus real resource/provider evidence. Do not use those terms interchangeably.
