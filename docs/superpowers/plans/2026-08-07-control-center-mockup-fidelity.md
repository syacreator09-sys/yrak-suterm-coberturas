# YRAK Control Center — Mockup Fidelity Plan

**Target visual:** mockup aprobado en conversación el 2026-08-07.
**Implementation branch:** `feature/control-center-mockup-v1`.
**Base:** `feature/control-center-v1`.
**Rule:** no merge to `main` until executable verification is complete.

## Objective

Convert the approved dark YRAK Control Center mockup into the real `apps/admin-web` interface without duplicating domain rules, inventing business metrics, exposing secrets, or weakening RBAC/security.

## LOOP 1 — Design system

- Lock dark palette, surfaces, borders, typography, radii, spacing and semantic colors.
- Apply the system globally to tables, forms, dialogs, alerts, badges and secondary pages.
- Keep all dynamic content escaped.

**Exit:** no page falls back to the old light design.

## LOOP 2 — Overview composition

Implement the approved first viewport:

- five KPI cards;
- coverage status donut;
- upcoming coverage table;
- recent activity panel;
- agent status panel;
- model usage panel;
- infrastructure status strip.

**Truthfulness rule:** a metric without an authoritative source renders `—`, `Sin telemetría`, `Sin verificar` or `No configurado`; no synthetic operational numbers.

## LOOP 3 — Shell fidelity

- YRAK brand block;
- grouped left navigation;
- compact topbar;
- quick navigation search;
- organization, role, environment and global status;
- responsive mobile drawer.

**Exit:** shell hierarchy and density match the approved mockup while all controls remain functional.

## LOOP 4 — Data wiring

Use current authenticated endpoints where possible:

- `/v1/employees`;
- `/v1/reference/groups`;
- `/v1/coverage-cases`;
- `/v1/system/health`;
- `/v1/system/integrations`.

Do not add a backend endpoint only to make a chart look populated. Add server data only when it represents real system state and respects organization/group scope.

## LOOP 5 — Secondary screens

Validate visual consistency of:

- Coverages;
- Rotations;
- Competitions;
- Employees;
- Requirements;
- Documents / Intake;
- RAG;
- AI;
- Infrastructure;
- Audit;
- Reports;
- Settings.

No functional workflow is removed for visual fidelity.

## LOOP 6 — Security regression

Re-check:

- XSS escaping;
- no secrets in browser configuration;
- CSP compatibility;
- external URL validation;
- Cloudflare Access auth boundary;
- group scoping;
- role provisioning rules;
- intake ownership;
- CSV formula hardening;
- cross-site mutation defense.

## LOOP 7 — Type/tests/build gate

Required locally before merge:

```bash
pnpm --filter @yrak/admin-web typecheck
pnpm --filter @yrak/admin-web test
pnpm --filter @yrak/admin-web build
pnpm --filter @yrak/api-worker typecheck
pnpm --filter @yrak/api-worker test
pnpm --filter @yrak/api-worker build
pnpm typecheck
pnpm test
pnpm build
bash scripts/verify-control-center.sh
```

No GitHub Actions are required.

## LOOP 8 — Browser fidelity QA

At desktop width comparable to the approved mockup and at mobile width:

- compare sidebar width/density;
- topbar hierarchy;
- KPI geometry and colors;
- donut/table proportions;
- three-panel second row;
- infrastructure strip;
- typography and icon optical weight;
- overflow/wrapping;
- keyboard focus and navigation.

If browser tooling is unavailable in the current environment, this LOOP remains explicitly open and must be run after cloning locally.

## LOOP 9 — Integration

Only after LOOP 7 and 8 pass:

1. compare branch against `feature/control-center-v1`;
2. preserve a backup ref;
3. fast-forward `feature/control-center-v1` if still 0 behind;
4. run final verification again;
5. only then consider integrating to `main`.

## Current implementation notes

- The UI uses real visible coverage data for counts/distribution/upcoming rows.
- Alerts and personnel availability remain unpopulated until authoritative sources exist.
- Agent latency/health remains `Sin verificar` until an actual agent health endpoint exists.
- Model token/cost graph remains empty until telemetry is implemented.
- Integration cards report configuration detection, not fake health.

## Definition of done

The mockup is considered implemented only when the browser-rendered app is visually faithful, responsive, security checks remain intact, all build/test gates pass, and every visible operational value is sourced from real authorized data or explicitly marked unavailable.
