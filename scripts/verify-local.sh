#!/usr/bin/env bash
set -euo pipefail
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm build
printf '\nYRAK local verification completed.\n'
