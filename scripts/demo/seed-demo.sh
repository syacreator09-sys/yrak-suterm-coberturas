#!/usr/bin/env bash
# Seed the fictional demo dataset via the demo api-worker's HTTP API.
# Required env vars:
#   YRAK_API_BASE      https://yrak-suterm-coberturas-api-demo.yrak-suterm.workers.dev
#   YRAK_USER_EMAIL     the real inbox that receives all demo offer emails
#   YRAK_DEV_TOKEN      the DEMO_DEV_AUTH_TOKEN from the scratchpad
set -euo pipefail
: "${YRAK_API_BASE:?set YRAK_API_BASE}"
: "${YRAK_USER_EMAIL:?set YRAK_USER_EMAIL}"
: "${YRAK_DEV_TOKEN:?set YRAK_DEV_TOKEN}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXAMPLES="$ROOT_DIR/examples/demo"
ALIAS_BASE="${YRAK_USER_EMAIL%%@*}"
ALIAS_DOMAIN="${YRAK_USER_EMAIL#*@}"

curl_json() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "${YRAK_API_BASE}${path}" -H "content-type: application/json" \
      -H "x-yrak-user-email: ${YRAK_USER_EMAIL}" -H "x-yrak-dev-token: ${YRAK_DEV_TOKEN}" -d "$body"
  else
    curl -sS -X "$method" "${YRAK_API_BASE}${path}" \
      -H "x-yrak-user-email: ${YRAK_USER_EMAIL}" -H "x-yrak-dev-token: ${YRAK_DEV_TOKEN}"
  fi
}

echo "== [1/9] Catálogo (2 grupos, niveles, transiciones) ==" >&2
curl_json POST /v1/import/catalog "$(jq -c '{groups}' "$EXAMPLES/catalog.json")" | jq -c .

echo "== [2/9] Empleados (con email +alias real) ==" >&2
EMP_JSON=$(jq -c --arg base "$ALIAS_BASE" --arg domain "$ALIAS_DOMAIN" \
  '{items: [.items[] | . + {email: ($base + "+" + .id + "@" + $domain)}]}' "$EXAMPLES/employees.json")
curl_json POST /v1/import/employees "$EMP_JSON" | jq -c .

echo "== [3/9] Requisitos ==" >&2
curl_json POST /v1/import/requirements "$(cat "$EXAMPLES/requirements.json")" | jq -c .

echo "== [4/9] Mapear requisitos al Nivel 8 de Distribución (mandatory=1) ==" >&2
curl_json PUT /v1/config/levels/demo-dist-n8/requirements/demo-req-curso-n8 '{"mandatory":true,"validForEntireCoverage":true}' | jq -c .
curl_json PUT /v1/config/levels/demo-dist-n8/requirements/demo-req-cert-seguridad '{"mandatory":true,"validForEntireCoverage":true}' | jq -c .

echo "== [5/9] Cumplimiento mixto deliberado (ELG-01/02/03) ==" >&2
# demo-emp-01..02: COMPLIANT vigente (elegibles)
# demo-emp-03: COMPLIANT pero vence a mitad de una cobertura de ejemplo (ELG-03)
# demo-emp-04: EXPIRED (para ver el barrido cron y ELG-02)
# demo-emp-05..06: MISSING (nunca se registra -> ELG-01, no requiere llamada)
curl_json POST /v1/import/employee-requirements "$(jq -nc '{items:[
  {employeeId:"demo-emp-01",requirementId:"demo-req-curso-n8",status:"COMPLIANT",completedAt:"2025-01-10",validUntil:"2027-01-10"},
  {employeeId:"demo-emp-01",requirementId:"demo-req-cert-seguridad",status:"COMPLIANT",completedAt:"2025-06-01",validUntil:"2026-06-01"},
  {employeeId:"demo-emp-02",requirementId:"demo-req-curso-n8",status:"COMPLIANT",completedAt:"2025-02-15",validUntil:"2027-02-15"},
  {employeeId:"demo-emp-02",requirementId:"demo-req-cert-seguridad",status:"COMPLIANT",completedAt:"2025-07-01",validUntil:"2026-07-01"},
  {employeeId:"demo-emp-03",requirementId:"demo-req-curso-n8",status:"COMPLIANT",completedAt:"2025-01-01",validUntil:"2027-01-01"},
  {employeeId:"demo-emp-03",requirementId:"demo-req-cert-seguridad",status:"COMPLIANT",completedAt:"2025-01-01",validUntil:"2026-09-05"},
  {employeeId:"demo-emp-04",requirementId:"demo-req-curso-n8",status:"EXPIRED",completedAt:"2023-01-01",validUntil:"2025-01-01"}
]}')" | jq -c .

echo "== [6/9] Usuarios: SUPERVISOR (solo Distribución) + EMPLOYEE x10 (+alias) ==" >&2
SUP_EMAIL="${ALIAS_BASE}+demo-user-supervisor@${ALIAS_DOMAIN}"
curl_json POST /v1/import/users "$(jq -nc --arg email "$SUP_EMAIL" '{items:[{id:"demo-user-supervisor",email:$email,displayName:"Supervisor Distribución (DEMO)",role:"SUPERVISOR",groupIds:["demo-grupo-distribucion"]}]}')" | jq -c .
EMP_USERS=$(jq -c --arg base "$ALIAS_BASE" --arg domain "$ALIAS_DOMAIN" \
  '{items: [.items[] | {id: ("user-" + .id), email: ($base + "+" + .id + "@" + $domain), displayName: .name, role: "EMPLOYEE", employeeId: .id, groupIds: [.groupId]}]}' "$EXAMPLES/employees.json")
curl_json POST /v1/import/users "$EMP_USERS" | jq -c .

echo "== [7/9] Pools de rotación 7->8 en ambos grupos ==" >&2
curl_json POST /v1/config/rotation-pools "$(jq -nc '{groupId:"demo-grupo-distribucion",sourceLevelId:"demo-dist-n7",targetLevelId:"demo-dist-n8",employeeIds:["demo-emp-01","demo-emp-02","demo-emp-03","demo-emp-04","demo-emp-05","demo-emp-06"]}')" | jq -c .
curl_json POST /v1/config/rotation-pools "$(jq -nc '{groupId:"demo-grupo-comercial",sourceLevelId:"demo-com-n7",targetLevelId:"demo-com-n8",employeeIds:["demo-emp-07","demo-emp-08","demo-emp-09","demo-emp-10"]}')" | jq -c .

echo "== [8/9] Política demo (timer 2min, cascada, WORKING_DAYS) para ambos grupos ==" >&2
POLICY='{"dayCountingMode":"WORKING_DAYS","rejectionConsumesTurn":true,"cascadeEnabled":true,"cascadeMaximumDepth":3,"rotationOfferTimeoutMinutes":2,"effectiveFrom":"2020-01-01"}'
curl_json POST /v1/policies/groups/demo-grupo-distribucion/coverage "$POLICY" | jq -c .
curl_json POST /v1/policies/groups/demo-grupo-comercial/coverage "$POLICY" | jq -c .

echo "== [9/9] Feriados MX + semana laboral 6 días para Comercial ==" >&2
curl_json POST /v1/import/holidays "$(cat "$EXAMPLES/holidays.json")" | jq -c .
curl_json PUT /v1/calendar/settings/demo-grupo-comercial '{"workingWeekdays":[1,2,3,4,5,6],"effectiveFrom":"2020-01-01"}' | jq -c .

echo "== Indisponibilidad de ejemplo (demo-emp-05, exclusión de candidato) ==" >&2
curl_json POST /v1/employees/demo-emp-05/unavailability '{"kind":"VACATION","startDate":"2026-09-01","endDate":"2026-09-10","reason":"Vacaciones (DEMO)"}' | jq -c .

echo "Seed completo." >&2
echo "SUPERVISOR_EMAIL=$SUP_EMAIL"
echo "EMPLOYEE_EMAILS=${ALIAS_BASE}+demo-emp-01@${ALIAS_DOMAIN} .. ${ALIAS_BASE}+demo-emp-10@${ALIAS_DOMAIN}"
