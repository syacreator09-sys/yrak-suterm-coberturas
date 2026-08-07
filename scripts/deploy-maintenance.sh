#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../apps/maintenance-worker"
pnpm exec wrangler deploy
