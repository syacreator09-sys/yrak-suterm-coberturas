#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

printf '== YRAK local bootstrap ==\n'

if ! command -v node >/dev/null 2>&1; then
  echo 'ERROR: Node.js >=22 is required.' >&2
  exit 1
fi

if command -v corepack >/dev/null 2>&1; then
  corepack enable
fi

node scripts/doctor.mjs

printf '\n[1/3] Installing workspace dependencies\n'
pnpm install

copy_if_missing() {
  local source="$1"
  local target="$2"
  if [[ -e "$target" ]]; then
    printf 'KEEP  %s already exists\n' "$target"
  else
    cp "$source" "$target"
    printf 'CREATE %s from safe example\n' "$target"
  fi
}

printf '\n[2/3] Creating ignored local configuration files\n'
copy_if_missing apps/api-worker/.dev.vars.example apps/api-worker/.dev.vars
copy_if_missing apps/agent-worker/.dev.vars.example apps/agent-worker/.dev.vars
copy_if_missing apps/mcp-worker/.dev.vars.example apps/mcp-worker/.dev.vars
copy_if_missing apps/admin-web/.env.example apps/admin-web/.env.local

printf '\n[3/3] Re-running doctor in strict mode\n'
node scripts/doctor.mjs --strict

cat <<'EOF'

Bootstrap finished without provisioning external services.

NEXT (in this order):
  1. Edit only the ignored local .dev.vars/.env.local files.
  2. Run: bash scripts/migrate-local.sh
  3. Run: bash scripts/verify-release-candidate.sh
  4. Start API/Admin/Agent/MCP locally only after the gate passes.

Never put real API keys in tracked files, GitHub issues, or prompts.
EOF
