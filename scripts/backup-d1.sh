#!/usr/bin/env bash
set -euo pipefail
mkdir -p "$(dirname "$0")/../backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
cd "$(dirname "$0")/../apps/api-worker"
pnpm exec wrangler d1 export yrak-suterm-coberturas --remote --output="../../backups/yrak-${STAMP}.sql"
echo "Backup created: backups/yrak-${STAMP}.sql"
