# YRAK Public Control Center Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a public, no-login, pixel-faithful visual preview of the approved YRAK Control Center mockup without exposing or invoking any real YRAK runtime service or data.

**Architecture:** Keep the authenticated `apps/admin-web` runtime unchanged and add a separate Vite preview entry that renders only typed synthetic fixtures. Share safe presentation primitives/styles where useful, but preview-specific data and rendering never import the API client/session layer. Build and deploy the preview as an independent static project with no real environment secrets and no production domain changes.

**Tech Stack:** TypeScript 5.8.3, Vite 7, Vitest 3.2.4, existing DOM-rendered frontend/CSS system, isolated static deployment to Vercel or Netlify.

## Global Constraints

- Public preview contains synthetic/demo data only.
- Public preview makes zero API, D1, R2, Supabase, Upstash, Modal, provider, Gmail or RAG calls.
- Existing authenticated Control Center behavior and RBAC remain unchanged.
- Existing Vercel/Netlify production projects and custom domains are not modified.
- Preview visibly labels itself `Preview visual · datos demo`.
- No real IDs, personal email addresses, tokens, keys or production URLs may be present in preview fixtures or output.
- Desktop target follows the approved 1536×1024 mockup; mobile must remain usable and overflow-safe.

---

### Task 1: Add a typed preview data boundary

**Files:**
- Create: `apps/admin-web/src/preview/preview-data.ts`
- Create: `apps/admin-web/src/preview/preview-data.test.ts`

**Interfaces:**
- Produces: `PreviewDashboardData` and `previewDashboardData`.
- No imports from `core/api-client`, `core/session`, server connectors or environment secrets.

- [ ] **Step 1: Write the failing fixture-security test**

Create tests that recursively serialize `previewDashboardData` and assert it does not contain any of:

```ts
[
  'sk-', 'Bearer ', 'SUPABASE_SECRET_KEY', 'ACCESS_AUD',
  'GOOGLE_OAUTH_REFRESH_TOKEN', 'AI_COMPAT_API_KEY',
  '@yrak.mx', 'cloudflareaccess.com'
]
```

Also assert the fixture contains exactly five KPI cards and eight infrastructure services.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm --filter @yrak/admin-web test -- preview-data.test.ts
```

Expected: FAIL because `preview-data.ts` does not exist.

- [ ] **Step 3: Implement the typed synthetic fixture**

Define types for KPI, coverage row, activity, agent status, daily model usage and infrastructure service. Use synthetic values aligned with the approved mockup:

```ts
export const previewDashboardData: PreviewDashboardData = {
  kpis: [
    { id: 'active', label: 'Coberturas Activas', value: 24, detail: '12% vs semana anterior', tone: 'blue' },
    { id: 'upcoming', label: 'Próximas Coberturas', value: 18, detail: 'Siguientes 7 días', tone: 'green' },
    { id: 'competitions', label: 'Concursos Abiertos', value: 7, detail: '6+ días', tone: 'purple' },
    { id: 'alerts', label: 'Alertas Activas', value: 5, detail: 'Requieren atención', tone: 'amber' },
    { id: 'personnel', label: 'Personal Disponible', value: 156, detail: 'Activos', tone: 'cyan' },
  ],
  // synthetic rows only
};
```

All identities use fictional names and `example.com` only when an address is necessary.

- [ ] **Step 4: Run the fixture tests and verify GREEN**

```bash
pnpm --filter @yrak/admin-web test -- preview-data.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin-web/src/preview/preview-data.ts apps/admin-web/src/preview/preview-data.test.ts
git commit -m "feat(admin): add safe public preview fixture"
```

---

### Task 2: Build a dedicated public-preview shell

**Files:**
- Create: `apps/admin-web/src/preview/preview-shell.ts`
- Create: `apps/admin-web/src/preview/preview-shell.test.ts`

**Interfaces:**
- Consumes: `PreviewDashboardData` presentation metadata.
- Produces: `mountPreviewShell(root: HTMLElement): { view: HTMLElement }`.

- [ ] **Step 1: Write RED tests for preview shell safety and anatomy**

Test rendered HTML contains:

```text
YRAK
Control Center
Overview
OPERACIÓN
DOCUMENTOS & RAG
IA & AGENTES
INFRAESTRUCTURA
AUDITORÍA
REPORTES
SISTEMA
Preview visual · datos demo
```

and does not contain a form with a mutation action or real account selector.

- [ ] **Step 2: Run test and verify RED**

```bash
pnpm --filter @yrak/admin-web test -- preview-shell.test.ts
```

- [ ] **Step 3: Implement shell markup**

Match the approved sidebar/topbar. Include visual notification/help/admin controls as non-submitting buttons with `aria-disabled="true"` where no preview behavior exists. Keep the sidebar drawer toggle functional on mobile.

- [ ] **Step 4: Run test and verify GREEN**

```bash
pnpm --filter @yrak/admin-web test -- preview-shell.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin-web/src/preview/preview-shell.ts apps/admin-web/src/preview/preview-shell.test.ts
git commit -m "feat(admin): add isolated preview shell"
```

---

### Task 3: Render the approved Overview composition from fixtures

**Files:**
- Create: `apps/admin-web/src/preview/preview-overview.ts`
- Create: `apps/admin-web/src/preview/preview-overview.test.ts`

**Interfaces:**
- Consumes: `PreviewDashboardData`.
- Produces: `renderPreviewOverview(root: HTMLElement, data: PreviewDashboardData): void`.

- [ ] **Step 1: Write RED structure tests**

Assert the renderer produces:

```text
5 KPI cards
1 coverage donut
1 upcoming coverage table
1 recent activity panel
4 agent rows
7 model-usage day groups
8 infrastructure cells
```

- [ ] **Step 2: Run RED test**

```bash
pnpm --filter @yrak/admin-web test -- preview-overview.test.ts
```

- [ ] **Step 3: Implement the renderer**

Use existing safe icon/rendering helpers where they do not import API/session code. Escape every fixture string with `escapeText`. Build donut segments from fixture counts and stacked bars from fixture token-series values.

- [ ] **Step 4: Run GREEN test**

```bash
pnpm --filter @yrak/admin-web test -- preview-overview.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin-web/src/preview/preview-overview.ts apps/admin-web/src/preview/preview-overview.test.ts
git commit -m "feat(admin): render approved preview overview"
```

---

### Task 4: Match the approved mockup styling

**Files:**
- Create: `apps/admin-web/src/styles/preview.css`
- Modify: `apps/admin-web/src/styles.css`
- Modify as needed: `apps/admin-web/src/styles/tokens.css`
- Modify as needed: `apps/admin-web/src/styles/layout.css`
- Modify as needed: `apps/admin-web/src/styles/components.css`

**Interfaces:**
- Preview-specific selectors use `.public-preview` root namespace to prevent style regressions in authenticated runtime.

- [ ] **Step 1: Add the preview stylesheet import**

```css
@import './styles/preview.css';
```

- [ ] **Step 2: Implement desktop layout fidelity**

At ≥1280 px use approximately:

```css
.public-preview .sidebar { width: 212px; }
.public-preview .overview-kpi-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.public-preview .dashboard-primary-grid { grid-template-columns: minmax(320px, .52fr) minmax(0, 1fr); }
.public-preview .dashboard-secondary-grid { grid-template-columns: minmax(330px, .95fr) minmax(300px, .78fr) minmax(430px, 1.25fr); }
```

Use deep navy background, subtle blue-gray borders, compact 10–14 px supporting text and restrained gradients matching the reference.

- [ ] **Step 3: Implement mobile/tablet behavior**

At ≤900 px, make sidebar a drawer, stack panels and make wide tables horizontally scrollable. At ≤640 px, KPI cards become two-column or horizontal-scroller cards without text clipping.

- [ ] **Step 4: Run frontend typecheck/tests**

```bash
pnpm --filter @yrak/admin-web typecheck
pnpm --filter @yrak/admin-web test
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin-web/src/styles.css apps/admin-web/src/styles/preview.css apps/admin-web/src/styles/tokens.css apps/admin-web/src/styles/layout.css apps/admin-web/src/styles/components.css
git commit -m "style(admin): match approved Control Center mockup"
```

---

### Task 5: Add an isolated Vite preview entry and build target

**Files:**
- Create: `apps/admin-web/preview.html`
- Create: `apps/admin-web/src/preview.ts`
- Create or Modify: `apps/admin-web/vite.config.ts`
- Modify: `apps/admin-web/package.json`

**Interfaces:**
- `preview.html` loads `/src/preview.ts` only.
- `preview.ts` imports preview shell/data/renderer only; it must not import `app.ts`, `api-client.ts` or `session.ts`.
- Package scripts produce a deterministic `dist-preview/` output.

- [ ] **Step 1: Add a source-boundary test**

Create `apps/admin-web/src/preview/preview-boundary.test.ts` that reads preview entry/source text and rejects these imports:

```text
core/api-client
core/session
/v1/
VITE_DEV_USER_EMAIL
```

- [ ] **Step 2: Run RED test**

```bash
pnpm --filter @yrak/admin-web test -- preview-boundary.test.ts
```

- [ ] **Step 3: Implement preview entry**

`preview.ts` should:

```ts
import './styles.css';
import { previewDashboardData } from './preview/preview-data.js';
import { mountPreviewShell } from './preview/preview-shell.js';
import { renderPreviewOverview } from './preview/preview-overview.js';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('APP_ROOT_NOT_FOUND');
root.classList.add('public-preview');
const shell = mountPreviewShell(root);
renderPreviewOverview(shell.view, previewDashboardData);
```

- [ ] **Step 4: Configure multi-entry Vite build**

Add scripts:

```json
"dev:preview": "vite preview.html",
"build:preview": "vite build --mode preview"
```

Configure the preview mode output directory as `dist-preview` and use `preview.html` as the preview build entry without changing the normal `index.html` build.

- [ ] **Step 5: Run both builds**

```bash
pnpm --filter @yrak/admin-web build
pnpm --filter @yrak/admin-web build:preview
```

Expected: both exit 0 and produce independent outputs.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-web/preview.html apps/admin-web/vite.config.ts apps/admin-web/package.json apps/admin-web/src/preview.ts apps/admin-web/src/preview/preview-boundary.test.ts
git commit -m "build(admin): add isolated public preview target"
```

---

### Task 6: Add preview-output secret and network boundary gates

**Files:**
- Create: `scripts/check-public-preview.mjs`
- Modify: `package.json`
- Modify: `scripts/verify-release-candidate.sh`

**Interfaces:**
- Produces root command `pnpm verify:public-preview`.

- [ ] **Step 1: Implement the checker**

The script recursively reads `apps/admin-web/dist-preview` after build and fails if any file contains:

```text
SUPABASE_SECRET_KEY
GOOGLE_OAUTH_REFRESH_TOKEN
AI_COMPAT_API_KEY
ACCESS_AUD
Cf-Access-Jwt-Assertion
x-yrak-user-email
Bearer 
/v1/
```

It also asserts `preview.html`/built JS include `Preview visual`.

- [ ] **Step 2: Add root command**

```json
"verify:public-preview": "pnpm --filter @yrak/admin-web build:preview && node scripts/check-public-preview.mjs"
```

- [ ] **Step 3: Add syntax/static coverage to RC gate**

Add `node --check scripts/check-public-preview.mjs` to the existing operational-script syntax section, but do not make public-preview deployment a prerequisite for backend staging.

- [ ] **Step 4: Run the preview gate**

```bash
pnpm verify:public-preview
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/check-public-preview.mjs scripts/verify-release-candidate.sh
git commit -m "test(admin): gate public preview output"
```

---

### Task 7: Document public-preview deployment and isolation

**Files:**
- Create: `docs/PUBLIC_PREVIEW.md`
- Modify: `docs/CLONE_TEST_CONNECT.md`

**Interfaces:**
- Documents exact local commands and deployment safety rules.

- [ ] **Step 1: Document local preview**

```bash
pnpm --filter @yrak/admin-web dev:preview
pnpm verify:public-preview
```

- [ ] **Step 2: Document deployment contract**

State explicitly:

```text
Project: isolated preview project only
Output: apps/admin-web/dist-preview
Authentication: public/no platform login
Environment secrets: none
Custom domain: none during review
Backend/API: none
```

- [ ] **Step 3: Document cleanup**

The preview can be deleted independently without changing YRAK runtime or `main`.

- [ ] **Step 4: Commit**

```bash
git add docs/PUBLIC_PREVIEW.md docs/CLONE_TEST_CONNECT.md
git commit -m "docs: add public preview runbook"
```

---

### Task 8: Perform visual QA against the approved screenshot

**Files:**
- Modify only files identified by observed mismatch from Tasks 2–4.

**Interfaces:**
- Input: built preview and approved screenshot.
- Output: accepted desktop/mobile render.

- [ ] **Step 1: Start preview locally**

```bash
pnpm --filter @yrak/admin-web dev:preview --host 127.0.0.1
```

- [ ] **Step 2: Capture desktop at 1536×1024**

Compare sidebar width, card heights, grid ratios, table density, donut dimensions, agent rows, usage chart and infrastructure strip against reference.

- [ ] **Step 3: Fix observed mismatches only**

Do not change backend/API code to improve a visual screenshot.

- [ ] **Step 4: Capture mobile at 390×844**

Verify no horizontal page overflow, drawer opens/closes, KPI content is readable and tables scroll inside their panel.

- [ ] **Step 5: Re-run preview gate**

```bash
pnpm --filter @yrak/admin-web typecheck
pnpm --filter @yrak/admin-web test
pnpm verify:public-preview
```

- [ ] **Step 6: Commit visual corrections**

```bash
git add apps/admin-web/src apps/admin-web/preview.html
git commit -m "fix(admin): align public preview with approved mockup"
```

---

### Task 9: Deploy an isolated public preview and verify anonymous access

**Files:**
- No runtime repository files unless deployment metadata is intentionally documented.

**Interfaces:**
- Consumes: `apps/admin-web/dist-preview`.
- Produces: one public HTTPS preview URL.

- [ ] **Step 1: Prefer isolated Vercel preview project**

Deploy only `dist-preview` to the existing isolated preview project or a newly isolated project. Do not link/reconfigure other user Vercel projects.

- [ ] **Step 2: Remove platform-level deployment protection for this isolated preview only**

If the available Vercel connector cannot safely make the preview anonymously accessible, do not alter team-wide protection settings. Use an isolated Netlify site instead.

- [ ] **Step 3: Verify anonymous access**

Open URL in a logged-out/incognito context. Expected: HTTP 200 and the YRAK preview, not `You Need Access`.

- [ ] **Step 4: Verify network behavior**

Browser network panel must show only static preview assets. Expected: zero `/v1/`, Supabase, Cloudflare API, Gmail, model-provider or RAG requests.

- [ ] **Step 5: Share URL only after anonymous verification**

Record deployment provider/project and URL in the implementation handoff; do not record secrets.

---

### Task 10: Final regression and handoff

**Files:**
- Modify: `docs/PUBLIC_PREVIEW.md` only if observed deployment details need recording.

- [ ] **Step 1: Re-run authenticated admin checks**

```bash
pnpm --filter @yrak/admin-web typecheck
pnpm --filter @yrak/admin-web test
pnpm --filter @yrak/admin-web build
```

- [ ] **Step 2: Re-run preview gate**

```bash
pnpm verify:public-preview
```

- [ ] **Step 3: Confirm scope diff**

No API/domain/migration changes are allowed as part of this visual-preview feature unless separately reviewed.

- [ ] **Step 4: Final commit**

```bash
git add docs/PUBLIC_PREVIEW.md
git commit -m "docs: record verified public preview"
```

- [ ] **Step 5: Report evidence**

Report exact command results, anonymous-access verification, desktop/mobile QA status and public URL. Do not claim the real YRAK integrations are healthy from this preview.
