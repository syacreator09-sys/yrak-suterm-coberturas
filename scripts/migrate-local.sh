#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../apps/api-worker"
pnpm exec wrangler d1 migrations apply yrak-suterm-coberturas --local
