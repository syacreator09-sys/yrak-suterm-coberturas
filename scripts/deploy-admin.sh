#!/usr/bin/env bash
set -euo pipefail
: "${YRAK_ADMIN_PAGES_PROJECT:=yrak-suterm-admin}"
cd "$(dirname "$0")/../apps/admin-web"
pnpm build
pnpm dlx wrangler@4 pages deploy dist --project-name="$YRAK_ADMIN_PAGES_PROJECT"
