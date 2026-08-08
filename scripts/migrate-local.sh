#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/api-worker"
pnpm exec wrangler d1 migrations apply yrak-suterm-coberturas --local --persist-to ../../.wrangler/state/yrak-local
