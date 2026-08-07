#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../apps/agent-worker"
pnpm exec wrangler deploy
