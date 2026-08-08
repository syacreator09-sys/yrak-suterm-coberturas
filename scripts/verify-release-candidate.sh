#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

printf '== YRAK release-candidate verification ==\n'

if ! command -v pnpm >/dev/null 2>&1; then
  echo 'ERROR: pnpm is required. Run bash scripts/bootstrap-local.sh first.' >&2
  exit 1
fi

printf '\n[1/13] Environment doctor\n'
node scripts/doctor.mjs --strict

printf '\n[2/13] Migration sequence audit\n'
node scripts/check-migrations.mjs

printf '\n[3/13] Tracked secret scan\n'
node scripts/secret-scan.mjs

printf '\n[4/13] Architecture/security boundaries\n'
node scripts/check-architecture-boundaries.mjs

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

printf '\n[5/13] Admin Control Center\n'
verify_package @yrak/admin-web 'Admin Control Center'

printf '\n[6/13] API Worker\n'
verify_package @yrak/api-worker 'API Worker'

printf '\n[7/13] Agent Worker\n'
verify_package @yrak/agent-worker 'Agent Worker'

printf '\n[8/13] MCP Worker\n'
verify_package @yrak/mcp-worker 'MCP Worker'

printf '\n[9/13] RAG core\n'
verify_package @yrak/rag 'RAG core'

printf '\n[10/13] Employee Portal\n'
verify_package @yrak/employee-portal 'Employee Portal'

printf '\n[11/13] Maintenance Worker\n'
verify_package @yrak/maintenance-worker 'Maintenance Worker'

printf '\n[12/13] Whole monorepo through Turbo\n'
pnpm typecheck
pnpm test
pnpm build

printf '\n[13/13] Operational script syntax\n'
node --check scripts/doctor.mjs
node --check scripts/check-migrations.mjs
node --check scripts/secret-scan.mjs
node --check scripts/check-architecture-boundaries.mjs
node --check scripts/seed-local.mjs
node --check scripts/render-supabase-rag-schema.mjs
node --check scripts/smoke-local-connections.mjs
node --check scripts/smoke-agent-support.mjs
node --check scripts/smoke-rag.mjs
node --check scripts/smoke-ai-provider.mjs
bash -n scripts/bootstrap-local.sh
bash -n scripts/migrate-local.sh
bash -n scripts/verify-local.sh
bash -n scripts/verify-control-center.sh
bash -n scripts/verify-release-candidate.sh

cat <<'EOF'

PASS: static/compile/test/build release-candidate gate completed.
This does NOT prove Cloudflare resources, D1 migrations, agents, MCP, RAG external services, email, or external providers are connected.
NEXT: apply local migrations and run read-only connection/E2E smoke tests before staging.
EOF
