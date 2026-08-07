#!/usr/bin/env bash
set -euo pipefail
: "${CLOUDFLARE_ACCOUNT_ID:?Set CLOUDFLARE_ACCOUNT_ID}"
cd "$(dirname "$0")/../apps/api-worker"
pnpm exec wrangler d1 migrations apply yrak-suterm-coberturas --remote
