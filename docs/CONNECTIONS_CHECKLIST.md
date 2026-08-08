# YRAK — Connection & Secret Checklist

No real credential value belongs in this document, Git, a PR, an issue, screenshots or browser variables.

## Cloudflare staging

The staging renderer requires explicit confirmation plus these public/non-secret deployment values:

- `YRAK_STAGING_D1_DATABASE_ID`
- `YRAK_STAGING_D1_DATABASE_NAME`
- `YRAK_STAGING_ORGANIZATION_ID`
- `YRAK_STAGING_ACCESS_TEAM_DOMAIN` (`<team>.cloudflareaccess.com`)
- `YRAK_STAGING_ACCESS_AUD`
- `YRAK_STAGING_EMAIL_FROM` (verified sender)
- `YRAK_STAGING_R2_BUCKET`
- `YRAK_STAGING_QUEUE`
- `YRAK_STAGING_WORKFLOW`
- optional worker-name overrides: `YRAK_STAGING_API_WORKER_NAME`, `YRAK_STAGING_AGENT_WORKER_NAME`, `YRAK_STAGING_MCP_WORKER_NAME`, `YRAK_STAGING_MAINTENANCE_WORKER_NAME`

Render ignored staging configs only after confirming the values belong to the authorized staging environment:

```bash
CONFIRM_YRAK_STAGING=YES \
YRAK_STAGING_D1_DATABASE_ID=... \
YRAK_STAGING_D1_DATABASE_NAME=... \
YRAK_STAGING_ORGANIZATION_ID=... \
YRAK_STAGING_ACCESS_TEAM_DOMAIN=... \
YRAK_STAGING_ACCESS_AUD=... \
YRAK_STAGING_EMAIL_FROM=... \
YRAK_STAGING_R2_BUCKET=... \
YRAK_STAGING_QUEUE=... \
YRAK_STAGING_WORKFLOW=... \
pnpm render:cloudflare-staging

CONFIRM_YRAK_STAGING=YES pnpm preflight:staging
```

The generated `wrangler.staging.local.jsonc` files are ignored by Git, use Worker names ending in `-staging`, and contain non-secret staging identifiers only. Cloudflare authentication itself should use Wrangler's normal authenticated flow; do not commit an account API token into the repo.

### One-time empty staging bootstrap

Generated staging config has bootstrap disabled. Only for the initial empty D1:

```bash
CONFIRM_YRAK_STAGING=YES \
CONFIRM_STAGING_BOOTSTRAP=YES \
pnpm staging:bootstrap:on

CONFIRM_YRAK_STAGING=YES \
CONFIRM_STAGING_BOOTSTRAP=YES \
ALLOW_STAGING_BOOTSTRAP=YES \
pnpm preflight:staging
```

Set `BOOTSTRAP_TOKEN` as a Worker secret, deploy/bootstrap exactly once, then immediately:

```bash
CONFIRM_YRAK_STAGING=YES pnpm staging:bootstrap:off
CONFIRM_YRAK_STAGING=YES pnpm preflight:staging
```

Redeploy the API with bootstrap disabled and delete/rotate the bootstrap secret when no longer required.

Server secrets to put into the applicable Worker using platform secret storage:

- API: `BOOTSTRAP_TOKEN` only during authorized initial staging bootstrap; RAG/provider secrets below when those adapters are enabled.
- Agents: `AGENT_API_TOKEN` plus provider key only when needed.
- MCP: `MCP_API_TOKEN`.

## Text/agent AI providers

Workers AI uses the Cloudflare binding and does not require a provider key in source.

Generic OpenAI-compatible path:

- `AI_COMPAT_PROVIDER_ID`
- `AI_COMPAT_BASE_URL`
- `AI_COMPAT_TEXT_MODEL`
- optional secret `AI_COMPAT_API_KEY`

For API Worker compatible mode also set:

- `AI_PROVIDER=compatible`

For Agent Worker routing use:

- `AI_PROFILE=local|development|staging|production`
- `AI_MAX_PROVIDER_ATTEMPTS`
- `AI_REQUEST_TIMEOUT_MS`

Ollama local normally has no key and should remain loopback/private. NVIDIA or other remote compatible providers use HTTPS + server-side key.

## RAG: Supabase + embeddings

Required for retrieval runtime:

- `SUPABASE_URL` — non-secret URL.
- `SUPABASE_SECRET_KEY` — server secret; never browser.
- optional `SUPABASE_RAG_RPC` (default `yrak_match_chunks`).
- `RAG_EMBEDDING_BASE_URL` — HTTPS remote or loopback local.
- `RAG_EMBEDDING_MODEL`.
- optional `RAG_EMBEDDING_API_KEY` — server secret.
- optional `RAG_REQUEST_TIMEOUT_MS`.

Before applying the Supabase schema, obtain the exact embedding dimensions and run:

```bash
RAG_EMBEDDING_DIMENSIONS=<exact-dimension> pnpm render:rag-schema
```

Review the generated ignored SQL before applying it to the intended Supabase project. The selected model used for document ingestion and query embeddings must be identical/compatible with the stored vector dimension.

Connection smoke:

```bash
DEV_USER_EMAIL=admin@example.com pnpm smoke:rag
```

After indexing an authorized synthetic document:

```bash
REQUIRE_RAG_RESULTS=YES DEV_USER_EMAIL=admin@example.com pnpm smoke:rag
```

## Agents

Local ignored file:

```text
apps/agent-worker/.dev.vars
```

Required local/staging identity values:

- `AGENT_ORGANIZATION_ID`
- `AGENT_API_TOKEN` (secret)

Model configuration follows the AI provider section above. Functional smoke:

```bash
AGENT_API_TOKEN=... pnpm smoke:agent
```

It uses a synthetic 4-day question and must preserve the `ROTATION` invariant; it does not create a coverage.

## MCP

Local ignored file:

```text
apps/mcp-worker/.dev.vars
```

Required:

- `MCP_ORGANIZATION_ID`
- `MCP_API_TOKEN` (secret)

Claude Code project `.mcp.json` reads:

- `YRAK_MCP_URL`
- `YRAK_MCP_TOKEN`

The shared MCP is business-data read-only. It may append `mcp_access_log` for auditing.

## Upstash — optional / not active yet

Reserved server-side names:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Do not provision it as a required dependency until a measured cache/lock/rate-limit use case justifies the adapter.

## Modal — adapter pending

Reserved server-side names:

- `MODAL_ENDPOINT_URL`
- `MODAL_API_TOKEN`

Use only after the concrete OCR/reranking/GPU job contract is implemented and tested.

## Hugging Face — workflow pending

Reserved:

- `HUGGINGFACE_TOKEN`

Do not report Hugging Face connected merely because the token exists. A selected model/artifact/job path and smoke test must exist first.

## Gmail test — OAuth smoke implemented; runtime adapter not required yet

This repository intentionally treats Gmail as a **test integration**, not as the canonical notification transport.

Required only in local shell/secret manager when testing:

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET` — secret
- `GOOGLE_OAUTH_REFRESH_TOKEN` — secret
- `GMAIL_TEST_ADDRESS`
- optional `GMAIL_TEST_RECIPIENT` (defaults to the test address)

OAuth refresh-only smoke; sends no message:

```bash
pnpm smoke:gmail
```

Actual synthetic send requires explicit confirmation:

```bash
CONFIRM_GMAIL_SEND_TEST=YES pnpm smoke:gmail
```

The script never prints access/refresh tokens or upstream error bodies. A successful OAuth refresh is not the same as a successful Gmail send; report them separately.

## Browser variables allowed

Only public frontend configuration belongs in `VITE_*`:

- `VITE_API_BASE_URL`
- `VITE_APP_ENV`
- `VITE_DEV_USER_EMAIL` (development build only)
- `VITE_EMPLOYEE_PORTAL_URL`

No provider/database/token credential may be added to `VITE_*`.

## Evidence rule

`configured` means required values/bindings are present. It does **not** mean healthy.

A connection may be reported healthy only after its specific live smoke succeeds on the exact environment being discussed.
