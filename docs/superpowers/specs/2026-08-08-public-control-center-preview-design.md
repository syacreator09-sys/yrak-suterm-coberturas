# YRAK Control Center — Public Preview Design

## Goal

Publish a public, no-login visual preview of the YRAK Control Center that matches the approved dark mockup as closely as practical while keeping the real administrative application, API, Cloudflare Access, D1, R2, RAG, agents, OAuth credentials, and provider secrets completely isolated.

## Approved visual target

The public preview must reproduce the approved mockup anatomy:

- fixed dark left sidebar with YRAK shield/brand;
- grouped navigation: Overview, Operación, Documentos & RAG, IA & Agentes, Infraestructura, Auditoría, Reportes, Sistema;
- compact topbar with page title, search, notification/help affordances and administration selector;
- five top KPI cards with blue, green, purple, amber and cyan treatments;
- coverage-status donut panel;
- upcoming-coverages table;
- recent-activity panel;
- agent-status panel;
- seven-day model-usage stacked bar chart;
- infrastructure strip for Cloudflare, Supabase, Upstash, Modal, NVIDIA NIM, Hugging Face, Ollama and Gmail;
- desktop composition matching the reference screenshot and a usable mobile/tablet adaptation.

## Architecture

The real `apps/admin-web` remains the authenticated Control Center and continues to load `/v1/me` and the real API. A separate preview entry point is added inside the same app package and built with an explicit preview mode. Preview mode never calls the API and never evaluates real session/authentication code.

The preview consumes a frozen typed fixture containing synthetic values matching the approved mockup. The fixture contains no real organization IDs, employee emails, credentials, tokens, API responses, D1 data or production URLs.

The preview build must be deployable as an independent static site/project. It must not share a production domain, API route, Cloudflare Access policy or environment secret with YRAK runtime services.

## Public access policy

The preview is intentionally public. Anyone with the URL may view it.

Therefore:

- no real data;
- no authenticated API calls;
- no secrets;
- no writable actions;
- no RAG query execution;
- no AI/provider calls;
- no Gmail/OAuth calls;
- no D1/R2/Supabase/Upstash/Modal calls;
- no Vercel/Netlify deployment protection that requires team membership;
- a persistent `Preview visual · datos demo` indicator must be visible.

## Real application boundary

Changes needed for visual fidelity may be shared with the real Control Center only when they are presentation-only and preserve existing RBAC, CSP, session and backend contracts. Preview-specific fixture logic must not be imported by the authenticated runtime entry point.

The real application must continue to show unverified/empty states when telemetry is not available. Synthetic preview metrics may never become fallback production data.

## Files and responsibilities

- `apps/admin-web/src/preview.ts` — isolated preview entry point.
- `apps/admin-web/src/preview/preview-data.ts` — typed synthetic fixture matching the approved screenshot.
- `apps/admin-web/src/preview/preview-overview.ts` — static Overview renderer using preview data only.
- `apps/admin-web/src/preview/preview-shell.ts` — public-preview shell and non-functional navigation affordances.
- `apps/admin-web/src/styles/preview.css` — preview-only fidelity adjustments.
- `apps/admin-web/preview.html` — Vite HTML entry for preview build/development.
- `apps/admin-web/vite.config.ts` — multi-entry build configuration, keeping the normal app unchanged.
- `apps/admin-web/src/preview/*.test.ts` — fixture/security/rendering tests.
- `docs/PUBLIC_PREVIEW.md` — build/deploy/view instructions and safety boundary.

## Visual fidelity requirements

Desktop reference target is approximately 1536×1024. At that size:

- sidebar width approximately 205–220 px;
- content density compact rather than oversized;
- top KPI cards share one row;
- first dashboard row is roughly 30/70 donut/table;
- second dashboard row is roughly 30/24/46 activity/agents/models;
- infrastructure spans the full width;
- panel borders are subtle blue-gray, not bright;
- background is deep navy/black, not pure flat black;
- typography hierarchy, spacing and card radii should visually track the mockup;
- no fake glass blur that changes the approved aesthetic.

Mobile requirements:

- sidebar becomes a drawer;
- KPI cards become a horizontally scrollable or stacked compact grid;
- wide tables scroll horizontally without clipping;
- dashboard panels stack in reading order;
- no fixed element may cover the page content.

## Synthetic preview data

The preview fixture uses the values shown in the approved visual reference, including representative values such as 24 active coverages, 18 upcoming, 7 competitions, 5 alerts and 156 available personnel. Names and activities are synthetic demonstration content only.

The real runtime must not import this fixture.

## Security requirements

- Add a test asserting the preview source does not import `core/api-client`, `core/session`, or any server connector.
- Add a test asserting fixture values contain no strings matching known secret prefixes or environment variable names.
- Preview build output must contain no `VITE_DEV_USER_EMAIL`, `ACCESS_AUD`, API keys, bearer tokens or OAuth tokens.
- Public preview CSP may permit only its own static assets; no external API `connect-src` is required.
- Links/buttons that imply mutation are visual only and must not submit requests.

## Deployment

Preferred deployment is an independent static preview project with a generated public URL. Existing Vercel projects/domains must not be modified. If Vercel Deployment Protection cannot be disabled safely for the isolated preview project through the available connector, deploy the static preview to an isolated Netlify project instead.

No custom domain is required for this review phase.

## Verification gates

Before sharing the public URL:

1. `pnpm --filter @yrak/admin-web typecheck` passes;
2. `pnpm --filter @yrak/admin-web test` passes;
3. normal admin build passes;
4. preview build passes;
5. static scan confirms no secret-bearing strings in preview output;
6. preview opens without authentication in a fresh unauthenticated browser session;
7. desktop screenshot is compared against the approved mockup;
8. mobile viewport is checked for overflow and drawer behavior;
9. normal authenticated app entry remains unchanged and still requires its session/API path.

## Non-goals

This preview does not prove Cloudflare, Supabase, agents, RAG, Gmail, model providers or D1 are connected. It is not a staging environment and must never be described as one.
