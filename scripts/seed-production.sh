#!/usr/bin/env bash
# Seed real production catalog data via the api-worker HTTP API (no direct SQL).
# Idempotent where the API allows checking for existing resources; for endpoints
# without a list/GET counterpart (level transitions) this script best-efforts
# idempotency by treating a non-2xx / no-id response as "already exists" and
# continuing rather than failing the whole run.
#
# Required env vars:
#   YRAK_API_BASE      e.g. https://yrak-suterm-coberturas-api.yrak-suterm.workers.dev
#   YRAK_USER_EMAIL     e.g. yrakelizalde9@gmail.com
#   YRAK_DEV_TOKEN      the DEV_AUTH_TOKEN configured on the worker
#
# Usage:
#   YRAK_API_BASE=... YRAK_USER_EMAIL=... YRAK_DEV_TOKEN=... ./scripts/seed-production.sh

set -euo pipefail

: "${YRAK_API_BASE:?set YRAK_API_BASE}"
: "${YRAK_USER_EMAIL:?set YRAK_USER_EMAIL}"
: "${YRAK_DEV_TOKEN:?set YRAK_DEV_TOKEN}"

GROUP_NAME="Grupo A"
PILOT_EMAIL="${YRAK_USER_EMAIL}"

curl_json() {
  # $1 = method, $2 = path, $3 = json body (optional)
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "${YRAK_API_BASE}${path}" \
      -H "content-type: application/json" \
      -H "x-yrak-user-email: ${YRAK_USER_EMAIL}" \
      -H "x-yrak-dev-token: ${YRAK_DEV_TOKEN}" \
      -d "$body"
  else
    curl -sS -X "$method" "${YRAK_API_BASE}${path}" \
      -H "x-yrak-user-email: ${YRAK_USER_EMAIL}" \
      -H "x-yrak-dev-token: ${YRAK_DEV_TOKEN}"
  fi
}

echo "== Grupo A ==" >&2
GROUP_ID=$(curl_json GET /v1/config/groups | jq -r --arg name "$GROUP_NAME" '.items[] | select(.name==$name) | .id' | head -n1)
if [ -z "${GROUP_ID:-}" ]; then
  GROUP_ID=$(curl_json POST /v1/config/groups "$(jq -nc --arg name "$GROUP_NAME" '{name:$name}')" | jq -r '.id')
  echo "Creado grupo $GROUP_NAME -> $GROUP_ID" >&2
else
  echo "Grupo $GROUP_NAME ya existe -> $GROUP_ID" >&2
fi

echo "== Niveles 5-8 ==" >&2
# Portable across bash 3.2 (macOS system bash has no associative arrays):
# resolve each level id via a small function instead of declare -A.
ensure_level() {
  local num="$1" name="$2" rank="$3"
  local existing
  existing=$(curl_json GET "/v1/config/groups/${GROUP_ID}/levels" | jq -r --argjson n "$num" '.items[] | select(.level_number==$n) | .id' | head -n1)
  if [ -z "${existing:-}" ]; then
    local lid
    lid=$(curl_json POST "/v1/config/groups/${GROUP_ID}/levels" "$(jq -nc --argjson number "$num" --arg name "$name" --argjson rankOrder "$rank" '{number:$number,name:$name,rankOrder:$rankOrder}')" | jq -r '.id')
    echo "Creado nivel $num ($name) -> $lid" >&2
    echo "$lid"
  else
    echo "Nivel $num ya existe -> $existing" >&2
    echo "$existing"
  fi
}

L5=$(ensure_level 5 "Nivel 5" 1)
L6=$(ensure_level 6 "Nivel 6" 2)
L7=$(ensure_level 7 "Nivel 7" 3)
L8=$(ensure_level 8 "Nivel 8" 4)

echo "== Transiciones 7->8, 6->7, 5->6 ==" >&2
# No GET endpoint exists for level_transitions, so this step is best-effort
# idempotent: a duplicate insert returns a non-201 error response which we log
# and continue past rather than treat as fatal.
create_transition() {
  local source="$1" target="$2" label="$3"
  local resp
  resp=$(curl_json POST "/v1/config/groups/${GROUP_ID}/transitions" "$(jq -nc --arg s "$source" --arg t "$target" '{sourceLevelId:$s,targetLevelId:$t}')")
  if echo "$resp" | jq -e '.id' >/dev/null 2>&1; then
    echo "Creada transicion $label -> $(echo "$resp" | jq -r '.id')" >&2
  else
    echo "Transicion $label: respuesta sin id (probablemente ya existia) -> $resp" >&2
  fi
}
create_transition "$L7" "$L8" "7->8"
create_transition "$L6" "$L7" "6->7"
create_transition "$L5" "$L6" "5->6"

echo "== Empleados piloto (base nivel 7) ==" >&2
declare -a EMP_IDS
for entry in "GA-101:Empleado Piloto Uno" "GA-102:Empleado Piloto Dos" "GA-103:Empleado Piloto Tres"; do
  NUMBER="${entry%%:*}"; NAME="${entry#*:}"
  EXISTING=$(curl_json GET /v1/employees | jq -r --arg num "$NUMBER" '.items[] | select(.employee_number==$num) | .id' | head -n1)
  if [ -z "${EXISTING:-}" ]; then
    EID=$(curl_json POST /v1/employees "$(jq -nc --arg num "$NUMBER" --arg name "$NAME" --arg email "$PILOT_EMAIL" --arg groupId "$GROUP_ID" --arg baseLevelId "$L7" '{employeeNumber:$num,name:$name,email:$email,groupId:$groupId,baseLevelId:$baseLevelId}')" | jq -r '.id')
    echo "Creado empleado $NUMBER ($NAME) -> $EID" >&2
  else
    EID="$EXISTING"
    echo "Empleado $NUMBER ya existe -> $EID" >&2
  fi
  EMP_IDS+=("$EID")
done

echo "== Pool de rotacion 7->8 + cola (mismo call) ==" >&2
EXISTING_POOL=$(curl_json GET "/v1/config/groups/${GROUP_ID}/rotation-pools" | jq -r --arg s "$L7" --arg t "$L8" '.items[] | select(.source_level_id==$s and .target_level_id==$t) | .id' | head -n1)
if [ -z "${EXISTING_POOL:-}" ]; then
  EMP_JSON=$(printf '%s\n' "${EMP_IDS[@]}" | jq -R . | jq -s .)
  POOL_ID=$(curl_json POST /v1/config/rotation-pools "$(jq -nc --arg groupId "$GROUP_ID" --arg s "$L7" --arg t "$L8" --argjson employeeIds "$EMP_JSON" '{groupId:$groupId,sourceLevelId:$s,targetLevelId:$t,employeeIds:$employeeIds}')" | jq -r '.id')
  echo "Creado pool 7->8 -> $POOL_ID (cola sembrada con ${#EMP_IDS[@]} empleados)" >&2
else
  POOL_ID="$EXISTING_POOL"
  echo "Pool 7->8 ya existe -> $POOL_ID (no se reenvia la cola: un pool solo admite una siembra)" >&2
fi

echo "== Politica de cobertura (ventana de oferta ampliada) ==" >&2
# Default rotationOfferTimeoutMinutes is 10, too short for a human-mediated
# email-accept step during the pilot. Extend it to 24h for Grupo A only so
# the offer created for the E2E gate does not expire before it can be
# accepted from the real inbox.
CURRENT_TIMEOUT=$(curl_json GET "/v1/policies/groups/${GROUP_ID}/coverage" | jq -r '.config.rotationOfferTimeoutMinutes // empty')
if [ "${CURRENT_TIMEOUT:-0}" != "1440" ]; then
  curl_json POST "/v1/policies/groups/${GROUP_ID}/coverage" '{"dayCountingMode":"CALENDAR_DAYS","rejectionConsumesTurn":true,"cascadeEnabled":false,"cascadeMaximumDepth":10,"rotationOfferTimeoutMinutes":1440,"effectiveFrom":"2020-01-01"}' | jq -r '"Politica actualizada, version " + (.version|tostring)' >&2
else
  echo "Politica ya tiene rotationOfferTimeoutMinutes=1440" >&2
fi

echo "== Usuarios EMPLOYEE (login) ==" >&2
# users.email is UNIQUE per organization and PILOT_EMAIL is already taken by
# the ADMIN account used for these curls, so each pilot login uses a Gmail
# "+alias" of PILOT_EMAIL: still delivers to the same real inbox but gives
# each employee a distinct, independently-loggable identity in the system
# (required so the E2E gate can prove one EMPLOYEE cannot see another's data).
ALIAS_BASE="${PILOT_EMAIL%%@*}"
ALIAS_DOMAIN="${PILOT_EMAIL#*@}"
i=1
for EID in "${EMP_IDS[@]}"; do
  ALIAS="${ALIAS_BASE}+piloto${i}@${ALIAS_DOMAIN}"
  EXISTING_USER=$(curl_json GET /v1/config/users | jq -r --arg email "$ALIAS" '.items[] | select(.email==$email) | .id' | head -n1)
  if [ -z "${EXISTING_USER:-}" ]; then
    NAME=$(curl_json GET /v1/employees | jq -r --arg id "$EID" '.items[] | select(.id==$id) | .name')
    UID_=$(curl_json POST /v1/config/users "$(jq -nc --arg email "$ALIAS" --arg name "$NAME" --arg employeeId "$EID" --arg groupId "$GROUP_ID" '{email:$email,displayName:$name,role:"EMPLOYEE",employeeId:$employeeId,groupIds:[$groupId]}')" | jq -r '.id')
    echo "Creado usuario EMPLOYEE $ALIAS -> $UID_ (employeeId=$EID)" >&2
  else
    echo "Usuario EMPLOYEE $ALIAS ya existe -> $EXISTING_USER" >&2
  fi
  i=$((i+1))
done

echo "== Verificacion ==" >&2
curl_json GET /v1/employees | jq .

echo "GROUP_ID=$GROUP_ID"
echo "LEVEL5=$L5"
echo "LEVEL6=$L6"
echo "LEVEL7=$L7"
echo "LEVEL8=$L8"
echo "EMPLOYEES=${EMP_IDS[*]}"
