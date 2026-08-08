# YRAK Release Candidate Audit — v2

Branch audited: `ready/clone-test-connect-v2`  
Purpose: isolated clone/local-test/staging-connection candidate.  
Production status: **UNVERIFIED / DO NOT PROMOTE**.

This document distinguishes code hardening from observed runtime evidence. A code change is not considered operationally verified until the exact current head passes the corresponding executable gate.

## Hardening present in v2

### Cloudflare Access identity

- Remote API identity comes from `Cf-Access-Jwt-Assertion`, not the email header.
- RS256/JWKS signature plus issuer/audience/exp/nbf/email are validated.
- Access team domain is restricted to HTTPS `*.cloudflareaccess.com`.
- `x-yrak-user-email` is accepted only for `APP_ENV=development` on an actual loopback request URL.
- OpenAPI documents the JWT credential.
- JWT/loopback failure-boundary tests exist.

**Still requires:** fresh API tests/build plus remote staging anti-header-spoof evidence.

### Bootstrap boundary

- Bootstrap requires `BOOTSTRAP_ENABLED` + token.
- Production bootstrap is always denied.
- Development requires loopback.
- Staging requires explicit temporary enable.
- Existing organization makes bootstrap one-time.
- `scripts/set-staging-bootstrap.mjs` enables/disables only an isolated generated staging config with explicit confirmations.

**Still requires:** local seed and one-time staging bootstrap/disable/redeploy evidence.

### Agent Worker / model-data minimization

- Agent request body and session IDs are bounded.
- `/health` and `/ready` exist.
- Durable Object history is bounded.
- Raw intake text/extracted payload is not retained in session history.
- Raw audit facts are not retained in session history.
- Common PII keys in audit previous/new JSON are redacted before model use.
- Communication model payload excludes employee name/email/employee ID.
- AI continues to have no labor-decision authority.

**Open policy:** final time-based retention period requires organizational approval before production.

### MCP

- Business tools are read-only.
- Inputs are bounded and organization-scoped.
- `/health` and `/ready` exist.
- Bearer token is required.
- Coverage lookup uses explicit columns instead of `SELECT *`.
- Only allowed write is append-only `mcp_access_log`.
- Architecture gate rejects business-table mutation SQL in MCP.
- Project `.mcp.json` contains environment expansion, not a real secret.

**Still requires:** real Claude Code MCP handshake/tool calls on local/staging D1.

### Maintenance / notifications

- Maintenance Worker is the sole scheduled-maintenance owner; API no longer owns a cron.
- Notification delivery uses a conditional atomic claim before sending.
- Migration `0019_notification_processing_recovery.sql` adds `processing_started_at`.
- Stale processing claims are recovered by Maintenance.
- Provider raw error messages are not persisted into notification `last_error`.

**Still requires:** fresh D1 migration plus real concurrency/recovery integration evidence.

### Migration history

- Historical missing `0013` is documented in `migrations/sequence-exceptions.json` instead of renumbering history.
- Migration checker fails duplicate numbers, new undocumented gaps and stale exceptions.
- New DB changes remain forward-only.

**Still requires:** apply complete chain to fresh/shared local D1 and staging D1.

### RAG authorization/retrieval

Implemented:

- provider-agnostic RAG interfaces/controller;
- fail-closed organization/group boundary;
- active-document enforcement;
- top-K bounds;
- reranker cannot introduce new chunks or replace canonical retrieved text;
- structured citations;
- generic OpenAI-compatible embeddings adapter;
- Supabase/PostgREST pgvector RPC retriever;
- dimension-rendered Supabase schema template with pgvector/HNSW and service-role-only retrieval RPC;
- server-side `/v1/rag/search` for `ADMIN/HR/AUDITOR`;
- query audit stores SHA-256 and result metadata, not raw query text;
- Control Center manual RAG search;
- RAG smoke script.

D1 remains canonical for labor state. Supabase is a knowledge sidecar only.

**Still requires:** actual Supabase project/schema, matching embedding model dimensions, synthetic indexed data and live retrieval/citation smoke. Full production ingestion/OCR/chunking/reranking/evaluation pipeline remains separate work.

### Gmail connection smoke

- OAuth refresh smoke does not print tokens or provider response bodies.
- Sending is disabled unless `CONFIRM_GMAIL_SEND_TEST=YES`.
- Send smoke is self-send only to `GMAIL_TEST_ADDRESS`.
- Message content is fixed synthetic text without labor data.

**Still requires:** dedicated test mailbox/client/refresh token and live smoke. This is not yet the production YRAK Gmail notification adapter.

### Claude Code skills/subagents

Project skills cover domain guardrails, verification, Cloudflare staging, MCP read-only, AI router and RAG connectors.

Subagents:

- `yrak-auditor` — Read/Glob/Grep only;
- `yrak-code-reviewer` — Read/Glob/Grep only;
- `yrak-test-runner` — command execution for evidence, no edits/deploy;
- `yrak-cloudflare-integrator` — staging integration with normal permission prompts.

All use `model: inherit`.

### Clone/staging tooling

Canonical branch/runbook: `ready/clone-test-connect-v2` / `docs/CLONE_TEST_CONNECT.md`.

Static gates include:

- environment doctor;
- package command-reference checker;
- migration checker;
- tracked secret scan;
- executable architecture-boundary checker;
- package-specific typecheck/tests/build for Admin/API/Agents/MCP/RAG/Employee/Maintenance;
- whole-workspace Turbo gates;
- operational script syntax checks.

Staging uses one canonical renderer: `scripts/render-staging-configs.mjs`.

It creates ignored `wrangler.staging.local.jsonc` files only after explicit `CONFIRM_YRAK_STAGING=YES`, validates non-secret resource identifiers and keeps secrets outside generated config. `scripts/staging-preflight.mjs` checks isolation, shared D1/org/queue, Access settings, placeholders and bootstrap window before any deploy.

## Current blockers

### BLOCKER — full monorepo gate has not run on v2 in this environment

Required on an actual clone of the exact head:

```bash
bash scripts/bootstrap-local.sh
pnpm verify:rc
```

This ChatGPT execution environment could not clone GitHub through shell because outbound DNS/network resolution to `github.com` failed. GitHub connector edits/audits do not substitute for a local compiler/test run.

### BLOCKER — no reviewed tracked `pnpm-lock.yaml`

Fresh install must generate/reconcile the lockfile. Review it, rerun all gates with the lockfile present, then commit it before calling the candidate reproducible.

### BLOCKER — local D1 chain/E2E not observed

Must run migration, seed, role/scope matrix and domain E2E on a fresh shared local D1 state.

### BLOCKER — external Cloudflare staging resources not provisioned/verified

Need authorized account authentication and actual staging D1/R2/Queue/DO/Workflow/Workers/Access resources plus secrets and remote health/auth smokes.

### BLOCKER — RAG external services not observed

Adapters/schema/runtime exist, but no real Supabase or embeddings endpoint has been called from this branch.

### BLOCKER — full RAG ingestion pipeline remains incomplete

Document ingestion/chunk writes/OCR/parser jobs, optional reranker adapter, evaluations and retention policies are not production-complete.

### BLOCKER — Modal / Hugging Face / optional Upstash adapters not implemented

Do not report them connected from env vars alone. A concrete job/cache/model contract plus tests is required before enabling them as runtime dependencies.

### BLOCKER — Gmail production adapter not implemented

The connection smoke exists; production OAuth token handling/send/read integration still needs an explicit adapter and tests if Gmail is selected for runtime mail.

### BLOCKER — browser/E2E/rollback evidence missing

Must observe:

- all seven role boundaries;
- organization/group A/B isolation;
- intake ownership/review;
- 1–5 rotation;
- 6+ competition;
- audit/export behavior;
- Access/CSP;
- notification claim/recovery;
- Agents/MCP/providers/RAG as enabled;
- desktop/mobile Control Center fidelity;
- backup/restore and rollback.

## Repository/license decision

The root license must be reviewed by the owner before public distribution. Do not automatically change licensing while fixing code; preserve required third-party attributions.

## Promotion rule

`ready/clone-test-connect-v2` is a **release candidate prepared for clone/testing**, not a verified release. Do not merge/promote it until every applicable blocker has fresh evidence on the exact promotion head and a final read-only security/code review is performed.
