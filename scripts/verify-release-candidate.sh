#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

printf '== YRAK release-candidate verification ==\n'

if ! command -v pnpm >/dev/null 2>&1; then
  echo 'ERROR: pnpm is required. Run bash scripts/bootstrap-local.sh first.' >&2
  exit 1
fi

printf '\n[1/11] Environment doctor\n'
node scripts/doctor.mjs --strict

printf '\n[2/11] Migration sequence audit\n'
node scripts/check-migrations.mjs

printf '\n[3/11] Tracked secret scan\n'
node scripts/secret-scan.mjs

verify_package() {
  local package="$1"
  local label="$2"
  printf '\n-- %s: typecheck --\n' "$label"
  pnpm --filter "$package" typecheck
  printf '\n-- %s: tests --\n' "$label"
  pnpm --filter "$package" test
  printf '\n-- %s: build --\n' "$label"
  pnpm --filter "$package" build
}

printf '\n[4/11] Admin Control Center\n'
verify_package @yrak/admin-web 'Admin Control Center'

printf '\n[5/11] API Worker\n'
verify_package @yrak/api-worker 'API Worker'

printf '\n[6/11] Agent Worker\n'
verify_package @yrak/agent-worker 'Agent Worker'

printf '\n[7/11] MCP Worker\n'
verify_package @yrak/mcp-worker 'MCP Worker'

printf '\n[8/11] Employee Portal\n'
verify_package @yrak/employee-portal 'Employee Portal'

printf '\n[9/11] Maintenance Worker\n'
verify_package @yrak/maintenance-worker 'Maintenance Worker'

printf '\n[10/11] Whole monorepo through Turbo\n'
pnpm typecheck
pnpm test
pnpm build

printf '\n[11/11] Operational script syntax\n'
node --check scripts/doctor.mjs
node --check scripts/check-migrations.mjs
node --check scripts/secret-scan.mjs
node --check scripts/smoke-ai-provider.mjs

cat <<'EOF'

PASS: static/compile/test/build release-candidate gate completed.
This does NOT prove Cloudflare resources, D1 migrations, agents, MCP, RAG, email, or external providers are connected.
NEXT: apply local migrations and run read-only connection/E2E smoke tests before staging.
EOF
