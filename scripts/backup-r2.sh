#!/usr/bin/env bash
set -euo pipefail
: "${CLOUDFLARE_ACCOUNT_ID:?Set CLOUDFLARE_ACCOUNT_ID}"
: "${AWS_ACCESS_KEY_ID:?Set R2 S3 access key as AWS_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY:?Set R2 S3 secret as AWS_SECRET_ACCESS_KEY}"
: "${YRAK_R2_BUCKET:=yrak-suterm-evidence}"
command -v aws >/dev/null 2>&1 || { echo "AWS CLI is required for R2 sync" >&2; exit 2; }
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$(dirname "$0")/../backups/r2-${STAMP}"
mkdir -p "$DEST"
ENDPOINT="https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com"
aws s3 sync "s3://${YRAK_R2_BUCKET}" "$DEST" --endpoint-url "$ENDPOINT" --no-progress
find "$DEST" -type f -print0 | sort -z | xargs -0 sha256sum > "${DEST}.sha256"
echo "R2 backup created: ${DEST}"
