#!/usr/bin/env bash
# Wipe transactional demo data (keeps catalog/employees/requirements/users)
# and re-run the seed. Makes the demo repeatable in minutes before each run.
set -euo pipefail
: "${CLOUDFLARE_API_TOKEN:?export CLOUDFLARE_API_TOKEN}"
: "${CLOUDFLARE_ACCOUNT_ID:?export CLOUDFLARE_ACCOUNT_ID}"
# seed-demo.sh's own required vars are checked here too, BEFORE the
# destructive DELETE block below runs — otherwise a missing var would only
# be caught by seed-demo.sh itself, after the demo data was already wiped,
# leaving the environment empty with nothing to re-seed it.
: "${YRAK_API_BASE:?set YRAK_API_BASE}"
: "${YRAK_USER_EMAIL:?set YRAK_USER_EMAIL}"
: "${YRAK_DEV_TOKEN:?set YRAK_DEV_TOKEN}"

cd "$(dirname "${BASH_SOURCE[0]}")/../../apps/api-worker"
npx wrangler d1 execute yrak-suterm-demo --env demo --remote --command "
DELETE FROM notifications;
DELETE FROM coverage_candidate_responses;
DELETE FROM coverage_candidate_evaluations;
DELETE FROM rotation_events;
DELETE FROM temporary_assignments;
DELETE FROM appeals;
DELETE FROM competition_score_revisions;
DELETE FROM competition_candidates;
DELETE FROM competitions;
DELETE FROM coverage_cases;
DELETE FROM holidays;
UPDATE rotation_queue_entries SET status='AVAILABLE', queue_position=queue_position+1000000;
UPDATE rotation_queue_entries SET queue_position=(SELECT COUNT(*) FROM rotation_queue_entries r2 WHERE r2.pool_id=rotation_queue_entries.pool_id AND r2.employee_id<=rotation_queue_entries.employee_id);
"
echo "Datos transaccionales del demo borrados. Re-corriendo seed..." >&2
cd -
"$(dirname "${BASH_SOURCE[0]}")/seed-demo.sh"
