#!/usr/bin/env bash
set -euo pipefail
: "${YRAK_PORTAL_PAGES_PROJECT:=yrak-suterm-portal}"
cd "$(dirname "$0")/../apps/employee-portal"
pnpm build
pnpm dlx wrangler@4 pages deploy dist --project-name="$YRAK_PORTAL_PAGES_PROJECT"
