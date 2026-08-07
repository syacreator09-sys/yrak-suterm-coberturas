#!/usr/bin/env bash
set -euo pipefail
: "${API_BASE_URL:?Set API_BASE_URL}"
: "${YRAK_TEST_EMAIL:?Set YRAK_TEST_EMAIL for local development}"
HDR=(-H "x-yrak-user-email: ${YRAK_TEST_EMAIL}")
curl -fsS "${API_BASE_URL}/health" >/dev/null
curl -fsS "${HDR[@]}" "${API_BASE_URL}/v1/config/groups" >/dev/null
curl -fsS "${HDR[@]}" "${API_BASE_URL}/v1/employees" >/dev/null
curl -fsS "${HDR[@]}" "${API_BASE_URL}/v1/coverage-cases" >/dev/null
echo "Smoke API completed"
