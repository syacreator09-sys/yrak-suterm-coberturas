# YRAK — Connection & Secret Checklist

No real credential value belongs in this document, Git, a PR, an issue, screenshots or browser variables.

## Cloudflare staging

Public/non-secret deployment values:

- `CLOUDFLARE_D1_DATABASE_ID`
- `YRAK_ORGANIZATION_ID`
- `ACCESS_TEAM_DOMAIN` (`<team>.cloudflareaccess.com`)
- `ACCESS_AUD`
- `EMAIL_FROM` (verified sender)

Use them only to render ignored staging configs:

```bash
CLOUDFLARE_D1_DATABASE_ID=... \
YRAK_ORGANIZATION_ID=... \
ACCESS_TEAM_DOMAIN=... \
ACCESS_AUD=... \
EMAIL_FROM=... \
pnpm render:cloudflare-staging

pnpm preflight:staging
```

Cloudflare authentication itself should use Wrangler's normal authenticated flow; do not commit an account API token into the repo.

Server secrets to put into the applicable Worker using platform secret storage:

- API: `BOOTSTRAP_TOKEN` only during authorized initial staging bootstrap; remove/rotate/disable afterward.
- Agents: `AGENT_API_TOKEN`.
- MCP: `MCP_API_TOKEN`.
- Optional provider secrets below only where the provider is enabled.

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

The selected model used for document ingestion and query embeddings must be identical/compatible with the stored vector dimension.

## Agents

Local ignored file:

```text
apps/agent-worker/.dev.vars
```

Required local/staging identity values:

- `AGENT_ORGANIZATION_ID`
- `AGENT_API_TOKEN` (secret)

Model configuration follows the AI provider section above.

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

## Gmail test — OAuth adapter pending

Current non-secret identity placeholder:

- `GMAIL_TEST_ADDRESS`

Future server secrets must use explicit OAuth names and secret storage (for example client secret/refresh token after the consent flow is implemented). Never use `VITE_*` for OAuth secrets.

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
