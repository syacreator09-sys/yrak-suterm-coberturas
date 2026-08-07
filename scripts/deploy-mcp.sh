#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../apps/mcp-worker"
pnpm exec wrangler deploy
