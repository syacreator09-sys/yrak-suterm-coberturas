#!/usr/bin/env bash
# Redeploy the full demo environment (api-worker, agent-worker, both Pages)
# after a code change. Assumes CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID
# are exported and the demo D1/R2/Queue already exist (see Task B1).
set -euo pipefail
: "${CLOUDFLARE_API_TOKEN:?export CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_ACCOUNT_ID:?export CLOUDFLARE_ACCOUNT_ID}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_URL="https://yrak-suterm-coberturas-api-demo.yrak-suterm.workers.dev"

echo "== api-worker (demo) ==" >&2
(cd "$ROOT_DIR/apps/api-worker" && npx wrangler deploy --env demo)

echo "== agent-worker (demo) ==" >&2
(cd "$ROOT_DIR/apps/agent-worker" && npx wrangler deploy --env demo)

# apps/admin-web/.env.local (and employee-portal's, if present) is meant only
# for local `pnpm dev` against production and bakes in production's own
# VITE_DEV_USER_EMAIL/VITE_DEV_AUTH_TOKEN. Vite's dotenv loader never
# overrides a variable already present in the shell environment, so exporting
# both as empty strings here neutralizes that file for this build only —
# without it, the demo bundle silently ships with production's dev-auth
# token baked into a public static site, and skips the intended login form
# entirely (empty string is falsy, so hasDevSession correctly stays false).
echo "== admin-web (demo) ==" >&2
(cd "$ROOT_DIR/apps/admin-web" && VITE_API_BASE_URL="$API_URL" VITE_DEV_USER_EMAIL="" VITE_DEV_AUTH_TOKEN="" pnpm build && npx wrangler pages deploy dist --project-name yrak-admin-web-demo --branch main --commit-dirty=true)

echo "== employee-portal (demo) ==" >&2
(cd "$ROOT_DIR/apps/employee-portal" && VITE_API_BASE_URL="$API_URL" VITE_DEV_USER_EMAIL="" VITE_DEV_AUTH_TOKEN="" pnpm build && npx wrangler pages deploy dist --project-name yrak-employee-portal-demo --branch main --commit-dirty=true)

echo "Demo redeploy completo. $API_URL" >&2
