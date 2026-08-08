#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "== YRAK Control Center verification gate =="
echo "Branch should be feature/control-center-v1 or a descendant under review."

if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm is required." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is required." >&2
  exit 1
fi

echo "Node: $(node --version)"
echo "pnpm: $(pnpm --version)"

echo "\n[1/9] Installing workspace dependencies"
pnpm install

echo "\n[2/9] Admin typecheck"
pnpm --filter @yrak/admin-web typecheck

echo "\n[3/9] Admin tests"
pnpm --filter @yrak/admin-web test

echo "\n[4/9] Admin build"
pnpm --filter @yrak/admin-web build

echo "\n[5/9] API typecheck"
pnpm --filter @yrak/api-worker typecheck

echo "\n[6/9] API tests"
pnpm --filter @yrak/api-worker test

echo "\n[7/9] API build"
pnpm --filter @yrak/api-worker build

echo "\n[8/9] Root workspace checks"
pnpm typecheck
pnpm test
pnpm build

echo "\n[9/9] Browser-secret regression scan"
ADMIN_BROWSER_PATHS=(
  "apps/admin-web/src"
  "apps/admin-web/public"
  "apps/admin-web/index.html"
)

FORBIDDEN_PATTERN='OPENAI_API_KEY|ANTHROPIC_API_KEY|AI_COMPAT_API_KEY|HUGGINGFACE_TOKEN|UPSTASH_REDIS_REST_TOKEN|SUPABASE_SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY|GMAIL_CLIENT_SECRET|BOOTSTRAP_TOKEN|MCP_API_TOKEN|AGENT_API_TOKEN'

if grep -RInE "$FORBIDDEN_PATTERN" "${ADMIN_BROWSER_PATHS[@]}"; then
  echo "ERROR: possible server secret name/value path referenced by browser bundle sources." >&2
  echo "Keep secret-bearing configuration server-side. Review any match before proceeding." >&2
  exit 1
fi

echo "\nPASS: compile/test/build commands and browser-secret regression scan completed."
echo "NEXT: run local D1/API migration + role/E2E tests before merge."
