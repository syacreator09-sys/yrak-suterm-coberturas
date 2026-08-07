#!/usr/bin/env bash
set -euo pipefail
SOURCE="${1:-}"
if [[ -z "$SOURCE" || ! -d "$SOURCE" ]]; then
  echo "Usage: scripts/restore-r2.sh backups/r2-YYYYMMDD-HHMMSS" >&2
  exit 2
fi
: "${CLOUDFLARE_ACCOUNT_ID:?Set CLOUDFLARE_ACCOUNT_ID}"
: "${AWS_ACCESS_KEY_ID:?Set R2 S3 access key as AWS_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY:?Set R2 S3 secret as AWS_SECRET_ACCESS_KEY}"
: "${YRAK_R2_BUCKET:=yrak-suterm-evidence}"
command -v aws >/dev/null 2>&1 || { echo "AWS CLI is required for R2 sync" >&2; exit 2; }
ENDPOINT="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
aws s3 sync "$SOURCE" "s3://${YRAK_R2_BUCKET}" --endpoint-url "$ENDPOINT" --no-progress
printf 'R2 restore upload completed. Validate attachment SHA-256 values against D1 before production use.\n'
