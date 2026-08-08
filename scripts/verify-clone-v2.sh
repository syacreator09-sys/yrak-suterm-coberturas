#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

printf '== YRAK clone v2 verification ==\n'

pnpm verify:rc

printf '\n== Critical route hardening regression ==\n'
node scripts/check-critical-route-hardening.mjs

cat <<'EOF'

PASS: clone v2 static verification wrapper completed.
This proves only the checks executed above on this checkout.
It does NOT prove local D1 migrations, role fixtures, E2E domain flows, Cloudflare staging, providers, RAG, Gmail, MCP or Agents are connected.
EOF
