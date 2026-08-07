#!/usr/bin/env bash
set -euo pipefail
FILE="${1:-}"
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: scripts/restore-d1.sh path/to/backup.sql" >&2
  exit 2
fi
ABS_FILE="$(cd "$(dirname "$FILE")" && pwd)/$(basename "$FILE")"
cd "$(dirname "$0")/../apps/api-worker"
pnpm exec wrangler d1 execute yrak-suterm-coberturas --remote --file="$ABS_FILE"
