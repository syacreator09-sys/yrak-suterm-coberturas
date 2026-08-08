---
name: yrak-domain-guardrails
description: Apply YRAK/SUTERM labor-domain invariants whenever modifying coverage, rotation, competition, eligibility, assignments, audit, agents, API or database code.
---

# YRAK domain guardrails

Before modifying domain-sensitive code, read `AGENTS.md` and `docs/REGLAS_NEGOCIO.md`.

Non-negotiable invariants:

1. 1–5 effective days inclusive => `ROTATION`.
2. 6+ effective days => `COMPETITION` with configured requirements/exam/ranking/human approval.
3. A temporary assignment never mutates the employee base level.
4. Every level move must use an authorized `level_transitions` edge. Cascades are temporary and configured.
5. AI may extract, explain, support and draft. AI never selects candidates/winners, changes scores, advances rotation queues or approves assignments.
6. Critical mutations require audit records.
7. Retryable mutations require idempotency.
8. Organization/group scope must be enforced in the API/database layer, never only in the browser.
9. Unknown labor policy stays configurable/pending; do not invent it in code.
10. Domain packages must not depend on Cloudflare, Hono or model-provider SDKs.

For every change, state which invariants are touched and name the tests that prove they remain true. If the required policy is not documented/configured, stop and add it to `docs/DECISIONES_PENDIENTES.md` instead of guessing.
