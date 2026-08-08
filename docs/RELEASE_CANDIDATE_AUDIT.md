# YRAK Release Candidate Audit

Branch audited: `ready/clone-test-connect-v1`  
Purpose: clone/local test/staging connection candidate.  
Production status: **NOT VERIFIED / DO NOT PROMOTE**.

This document records observed code changes and unresolved gates. A finding is not closed until the corresponding executable evidence exists on the current branch head.

## Fixed in this release candidate

### Critical — Cloudflare Access identity was not actually verified

**Previous state:** API middleware trusted `Cf-Access-Authenticated-User-Email` directly and accepted `x-yrak-user-email` whenever `APP_ENV=development`.

**Fix:**

- remote API requests require `Cf-Access-Jwt-Assertion`;
- RS256 signature verified against Cloudflare Access JWKS;
- `iss`, `aud`, `exp`, `nbf` and `email` validated;
- team domain restricted to HTTPS `*.cloudflareaccess.com`;
- local email bypass accepted only for `APP_ENV=development` + actual loopback request URL;
- JWT/config/JWKS failures classified into authentication vs service failures;
- OpenAPI now documents the signed JWT as the credential, not the email header;
- regression tests added.

**Remaining evidence:** full API typecheck/test/build and remote staging anti-header-spoof smoke.

### High — bootstrap endpoint needed stronger environment boundary

**Fix:**

- explicit `BOOTSTRAP_ENABLED` switch;
- production bootstrap is denied even if the flag is accidentally true;
- development bootstrap requires actual loopback;
- staging requires explicit enable + bootstrap token;
- bootstrap is one-time because an existing organization returns conflict;
- security headers/cross-site mutation guard cover `/bootstrap`;
- regression tests cover local/staging/production boundaries.

**Remaining evidence:** local seed + staging bootstrap-once/disabled-after test.

### High — Agent Worker accepted unbounded requests/session identifiers

**Fix:**

- request body capped at 128 KiB;
- `Content-Length` fast rejection + actual UTF-8 byte check;
- session IDs bounded;
- history route uses same validation;
- `/ready` checks configuration + D1;
- request-guard tests added.

### High — unnecessary model/history data retention

**Fix:**

- raw Intake text/extracted payload is not stored in Durable Object history;
- Audit history stores bounded explanation/count, not raw facts;
- common PII keys inside audit previous/new JSON are redacted before model use;
- Communication model input excludes employee name/email/employee ID;
- Communication history stores draft + human-approval flag, not source facts;
- session storage capped at 40 messages and context/history at 20.

**Open policy:** final time-based retention/privacy period remains an organizational policy decision before production.

### High — MCP needed stronger read-only/runtime boundaries

**Fix:**

- four business-data tools remain read-only;
- explicit selected columns replace `SELECT *` for coverage cases;
- bounded input IDs/entity types;
- `/health` + `/ready` added;
- exact bearer auth/config helper extracted and tested;
- organization scope retained in every tool query;
- only mutation allowed is append-only `mcp_access_log`;
- architecture checker fails if future MCP code introduces business-table mutation SQL;
- project `.mcp.json` uses environment expansion and contains no real secret.

**Remaining evidence:** real MCP protocol connection from Claude Code and synthetic tool calls against local/staging D1.

### High — local Workers could use different D1 state

**Fix:** API, Agents, MCP and Maintenance dev commands plus migration script share:

```text
.wrangler/state/yrak-local
```

Local ports are fixed:

- API `8787`
- Agents `8788`
- MCP `8789`
- Maintenance `8790`

### High — duplicate scheduled maintenance ownership

**Previous state:** both API Worker and Maintenance Worker contained scheduled maintenance logic, which could duplicate reconciliation/requeue work after deployment.

**Fix:**

- API Worker no longer has a scheduled handler or cron trigger;
- Maintenance Worker is the sole cron owner;
- executable architecture checker enforces this ownership.

### High — notification queue delivery was not atomically claimed

**Previous state:** two at-least-once queue deliveries could both observe `PENDING/FAILED` before either marked it processing.

**Fix:**

- delivery uses conditional atomic `PENDING/FAILED -> PROCESSING` claim;
- only the worker that changes one row sends;
- migration `0019_notification_processing_recovery.sql` adds `processing_started_at`;
- stale `PROCESSING` claims older than 10 minutes are recovered by Maintenance;
- provider raw error messages are not persisted as `last_error`.

**Remaining evidence:** apply migration locally and run concurrency/recovery integration tests with real D1/queue semantics.

### High — RAG needed an authorization boundary and executable retrieval path

**Fix:** `packages/rag` now provides provider-agnostic ports plus fail-closed controller.

Defense in depth:

- org/group filters passed to Retriever before retrieval;
- returned chunks revalidated against organization/group scope;
- group-scoped callers cannot receive groupless chunks;
- non-active documents are rejected;
- top-K bounded 1..20;
- reranker cannot introduce a new chunk or replace canonical retrieved text;
- citations retain document/chunk/page/section/version/source metadata.

Runtime connection pieces now exist:

- generic OpenAI-compatible `/embeddings` adapter;
- Supabase/PostgREST pgvector RPC retriever using server-side secret key;
- dimension-rendered Supabase pgvector/HNSW schema template;
- `POST /v1/rag/search` restricted to Control Center RAG roles (`ADMIN/HR/AUDITOR`);
- RAG query audit persists SHA-256, counts/IDs/scope/latency instead of raw query text;
- Control Center manual RAG search UI;
- `smoke:rag` for connection/citation contract.

**Remaining evidence:** actual Supabase project/schema, matching embedding model dimensions, synthetic indexed data and live smoke.

### Medium — integration UI could claim health from env vars alone

**Fix:** configuration detection remains separate from observed health. Supabase retrieval can report runtime configured only when URL/secret + embedding endpoint/model exist; the UI still requires an actual query before treating retrieval as working. Modal, Upstash, Hugging Face and Gmail continue to report pending adapter/runtime where appropriate.

### Medium — release verification did not cover all surfaces

**Fix:** added/expanded:

- `scripts/doctor.mjs`
- `scripts/check-migrations.mjs`
- `scripts/secret-scan.mjs`
- `scripts/check-architecture-boundaries.mjs`
- `scripts/bootstrap-local.sh`
- `scripts/seed-local.mjs`
- `scripts/render-supabase-rag-schema.mjs`
- `scripts/smoke-local-connections.mjs`
- `scripts/smoke-agent-support.mjs`
- `scripts/smoke-rag.mjs`
- `scripts/verify-release-candidate.sh`

`pnpm verify:rc` is intended to check Admin, API, Agents, MCP, RAG core, Employee Portal, Maintenance and whole Turbo workspace plus script syntax/architecture boundaries.

### Medium — project agent workflow was implicit

**Fix:** project Claude Code skills/subagents cover domain guardrails, verification, Cloudflare staging, MCP, AI router, RAG, read-only audit, test execution, code review and staging integration. Subagents use `model: inherit`; no model version is hard-coded. Auditor/code-reviewer have no Bash/Edit/Write tool surface.

## Open blockers before merge/staging

### BLOCKER — full monorepo gate not executed in this environment

Required on the cloned exact head:

```bash
bash scripts/bootstrap-local.sh
pnpm verify:rc
```

Do not infer results from isolated checks or from code review.

### BLOCKER — `pnpm-lock.yaml` is not currently tracked

First install must generate it. Review dependency resolution, rerun the complete gate with the lockfile present, then commit it. Do not call the release reproducible before this is done.

### BLOCKER — migrations not applied to a fresh/shared local D1 yet

The migration checker now preserves historical gap `0013` through a versioned exception and new changes continue forward-only through `0019`. The complete migration chain still must be applied to the shared local D1 state and then to staging before any promotion claim.

### BLOCKER — external Cloudflare resources are not provisioned/verified

D1/R2/Queue/DO/Workflow/Access/Workers AI resource IDs, routes and secrets must be created/resolved from the authorized account and tested.

### BLOCKER — RAG external connection has no observed evidence yet

The adapters/schema/API/UI exist, but Supabase and the selected embeddings endpoint have not been supplied or called from this release candidate. Do not call RAG healthy until schema application + live `smoke:rag` passes with matching vector dimensions.

### BLOCKER — ingestion/OCR/reranking pipeline is not complete

Retrieval is implemented. Document ingestion, chunk creation/embedding writes, parser/OCR jobs, optional reranker adapter and quality evaluations remain separate work before a full production knowledge pipeline.

### BLOCKER — Modal / Hugging Face / optional Upstash adapters are not implemented

Their roles are defined but no concrete account-specific runtime contract has been chosen/tested. Do not mark them configured/healthy merely because an env var exists.

### BLOCKER — Gmail OAuth adapter is not implemented

A test mailbox alone is not a Gmail connection. OAuth/client consent/token refresh/send/read behavior must be implemented and tested before the Dashboard can report it working.

### BLOCKER — browser/E2E fidelity and role matrix

The real cloned app must be run and checked for:

- Admin/Supervisor/Committee/Operator/Auditor/HR/Employee permissions;
- organization/group A/B isolation;
- Control Center desktop/mobile render;
- intake ownership/review;
- 1–5 rotation;
- 6+ competition;
- audit/CSV/export behavior;
- Access/CSP;
- notification recovery;
- RAG role restriction/citations;
- rollback/backup/restore.

## Legal/repository decision requiring owner confirmation

The root `LICENSE` currently grants the MIT License to the entire repository. That may be intentional, but it also permits broad use/modification/distribution/sublicensing. Do not alter license text automatically. Confirm desired licensing/ownership before public distribution or production handoff, while preserving any required third-party attributions.

## Promotion rule

This branch is a **release candidate prepared for clone/testing**, not a verified release. It must not be called production-ready until every blocker above has fresh executable evidence and a final code/security review is performed on the exact promotion head.
