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
- local email bypass accepted only for `APP_ENV=development` + loopback request URL;
- JWT/config/JWKS failures classified into authentication vs service failures;
- regression tests added.

**Remaining evidence:** full API typecheck/test/build and remote staging anti-header-spoof smoke.

### High — bootstrap endpoint did not fail closed

**Fix:**

- added `BOOTSTRAP_ENABLED` explicit switch;
- disabled when unset/not exactly `true`;
- local example enables it only for synthetic seed;
- bootstrap receives security headers and cross-site mutation protection;
- staging runbook requires disabling immediately after first bootstrap;
- regression test added for the switch.

**Remaining evidence:** local seed + staging bootstrap-once/disabled-after test.

### High — Agent Worker accepted unbounded bodies/session identifiers

**Fix:**

- request body capped at 128 KiB;
- `Content-Length` fast rejection + actual UTF-8 byte check;
- session IDs bounded;
- history route uses same session validation;
- `/ready` checks configuration + D1;
- request-guard tests added.

### High — unnecessary model data / unbounded session retention

**Fix:**

- Audit Agent no longer sends `actor_id` to the model;
- Communication Agent no longer sends employee email to the model;
- Durable Object stores at most 40 messages per session and exposes 20 recent messages to context/history.

**Open policy:** time-based retention/privacy policy remains an organizational decision and should be documented before production if stricter deletion is required.

### High — MCP needed stronger read-only/runtime boundaries

**Fix:**

- remains four read-only tools only;
- explicit selected columns replace `SELECT *` for coverage case;
- bounded input IDs/entity types;
- `/health` + `/ready` added;
- exact bearer auth/config helper extracted and tested;
- organization scope retained in every tool query;
- access logging retained;
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

### High — RAG had no implementation boundary

**Fix:** `packages/rag` now provides provider-agnostic ports and fail-closed security controller.

Defense in depth:

- org/group filters passed to Retriever before retrieval;
- returned chunks revalidated against organization/group scope;
- group-scoped callers cannot receive groupless chunks;
- retrieved document version must be `ACTIVE`;
- top-K bounded to 1..20 with safe default;
- reranker can only reorder retrieved chunk IDs;
- final text/citation comes from canonical Retriever chunk, not reranker-modified content;
- citations retain document/chunk/page/section/version/source metadata.

**Observed isolated evidence:** production RAG core compiled with TypeScript 5.8.3 strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`; separate authorization boundary assertions passed. This is not the monorepo gate.

### Medium — integration UI could claim adapters existed from env vars alone

**Fix:** Supabase, Upstash, Modal, Hugging Face and Gmail now report adapter pending even if a URL/token/mailbox variable is detected. NVIDIA/Ollama can report configured because they use the implemented OpenAI-compatible provider layer.

### Medium — release verification did not cover all surfaces

**Fix:** added:

- `scripts/doctor.mjs`
- `scripts/check-migrations.mjs`
- `scripts/secret-scan.mjs`
- `scripts/bootstrap-local.sh`
- `scripts/seed-local.mjs`
- `scripts/smoke-local-connections.mjs`
- `scripts/smoke-agent-support.mjs`
- `scripts/verify-release-candidate.sh`

`pnpm verify:rc` explicitly checks Admin, API, Agents, MCP, RAG core, Employee Portal, Maintenance and the whole Turbo workspace.

### Medium — project agent workflow was implicit

**Fix:** added project Claude Code skills/subagents for domain guardrails, verification, Cloudflare staging, MCP, AI router, RAG, read-only audit, test execution, code review and staging integration. Subagents use `model: inherit`; no model version is hard-coded.

## Open blockers before merge/staging

### BLOCKER — full monorepo gate not executed in this environment

Required on the cloned current head:

```bash
bash scripts/bootstrap-local.sh
pnpm verify:rc
```

Do not infer results from isolated checks.

### BLOCKER — `pnpm-lock.yaml` is not currently tracked

First install must generate it. Review the dependency resolution, rerun the complete gate with the lockfile present, then commit it. Do not call the release reproducible before this is done.

### BLOCKER — migration sequence/inventory must be observed from checkout

The GitHub connector used for this construction cannot list the private `migrations/` directory. `scripts/check-migrations.mjs` will detect missing/duplicate numeric prefixes during clone verification. Do not create a dummy migration or renumber an applied migration to silence the check.

### BLOCKER — external resources are not provisioned/verified

Cloudflare D1/R2/Queue/DO/Workflow/Access/Workers AI IDs and staging routes must be created/resolved from the authorized account and tested.

### BLOCKER — RAG external adapters are not implemented

Supabase pgvector, Modal compute, Hugging Face model workflow and optional Upstash cache require concrete account/schema/contracts before adapters can be implemented safely. Environment variables are not adapters.

### BLOCKER — Gmail OAuth adapter is not implemented

A test mailbox alone is not a Gmail connection. OAuth/client consent/token refresh/send/read behavior must be implemented and tested before the Dashboard can report it configured.

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
- rollback/backup/restore.

## Legal/repository decision requiring owner confirmation

The root `LICENSE` currently grants the MIT License to the entire repository. That may be intentional, but it also permits broad use/modification/distribution/sublicensing. Do not alter license text automatically. Confirm desired licensing/ownership before public distribution or production handoff, while preserving any required third-party attributions.

## Promotion rule

`ready/clone-test-connect-v1` may be called **clone-ready for observed testing** only after the branch is present and runbook/scripts are available. It must not be called **production-ready** until every BLOCKER above has fresh evidence and a final code/security review is performed on the exact promotion head.
