#!/usr/bin/env python3
"""YRAK end-to-end API scenario.

Requires a running development API with an ADMIN user already bootstrapped.
It does not run automatically and does not use GitHub Actions.
"""
from __future__ import annotations

import json
import os
import sys
import uuid
import urllib.error
import urllib.request

BASE = os.environ.get("API_BASE_URL", "http://127.0.0.1:8787").rstrip("/")
EMAIL = os.environ.get("YRAK_TEST_EMAIL")
if not EMAIL:
    raise SystemExit("Set YRAK_TEST_EMAIL to the bootstrapped admin email")


def request(method: str, path: str, body=None, extra_headers=None):
    data = None if body is None else json.dumps(body).encode()
    headers = {"x-yrak-user-email": EMAIL}
    if body is not None:
        headers["content-type"] = "application/json"
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            raw = response.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode()
        raise RuntimeError(f"{method} {path} -> {exc.code}: {payload}") from exc


def assert_equal(actual, expected, label):
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


def main():
    suffix = uuid.uuid4().hex[:8]
    print("[1] health")
    assert_equal(request("GET", "/health")["ok"], True, "health")

    print("[2] configure hierarchy")
    group = request("POST", "/v1/config/groups", {"name": f"E2E-{suffix}", "description": "automated local acceptance"})
    group_id = group["id"]
    level7 = request("POST", f"/v1/config/groups/{group_id}/levels", {"number": 7, "name": "Nivel 7", "rankOrder": 7})["id"]
    level8 = request("POST", f"/v1/config/groups/{group_id}/levels", {"number": 8, "name": "Nivel 8", "rankOrder": 8})["id"]
    request("POST", f"/v1/config/groups/{group_id}/transitions", {"sourceLevelId": level7, "targetLevelId": level8})

    print("[3] create level-7 employees and rotation queue")
    employees = []
    for index in range(3):
        employees.append(request("POST", "/v1/employees", {
            "employeeNumber": f"E2E-{suffix}-7{index+1}",
            "name": f"E2E Persona {index+1}",
            "email": f"e2e-{suffix}-{index+1}@example.com",
            "groupId": group_id,
            "baseLevelId": level7,
            "seniorityDate": f"20{18+index}-01-01",
        }))
    pool = request("POST", "/v1/config/rotation-pools", {
        "groupId": group_id,
        "sourceLevelId": level7,
        "targetLevelId": level8,
        "employeeIds": [item["id"] for item in employees],
    })

    print("[4] exact 5-day case => ROTATION")
    short = request("POST", "/v1/coverage-cases", {
        "groupId": group_id,
        "targetLevelId": level8,
        "startDate": "2026-09-01",
        "endDate": "2026-09-05",
        "reason": "E2E short",
    }, {"Idempotency-Key": f"short-{suffix}"})
    assert_equal(short["effectiveDays"], 5, "short effective days")
    assert_equal(short["processType"], "ROTATION", "short process")
    selected = request("POST", f"/v1/coverage-cases/{short['id']}/rotation/select")
    assert_equal(selected["employeeId"], employees[0]["id"], "first rotation candidate")
    request("POST", f"/v1/coverage-cases/{short['id']}/approve")
    request("POST", f"/v1/coverage-cases/{short['id']}/complete")
    queue = request("GET", f"/v1/config/rotation-pools/{pool['id']}/queue")["items"]
    assert_equal(queue[-1]["employee_id"], employees[0]["id"], "completed candidate moved to queue end")

    print("[5] configure long-coverage requirement")
    requirement = request("POST", "/v1/config/requirements", {
        "name": f"Certificación E2E {suffix}",
        "requirementType": "CERTIFICATION",
        "validityDays": 365,
    })
    request("PUT", f"/v1/config/levels/{level8}/requirements/{requirement['id']}", {
        "mandatory": True,
        "validForEntireCoverage": True,
    })
    for item in employees[:2]:
        request("PUT", f"/v1/employees/{item['id']}/requirements/{requirement['id']}", {
            "status": "COMPLIANT",
            "completedAt": "2026-01-01",
            "validUntil": "2027-01-01",
            "score": None,
            "evidenceAttachmentId": None,
        })

    print("[6] exact 6-day case => COMPETITION")
    long_case = request("POST", "/v1/coverage-cases", {
        "groupId": group_id,
        "targetLevelId": level8,
        "startDate": "2026-10-01",
        "endDate": "2026-10-06",
        "reason": "E2E long",
    }, {"Idempotency-Key": f"long-{suffix}"})
    assert_equal(long_case["effectiveDays"], 6, "long effective days")
    assert_equal(long_case["processType"], "COMPETITION", "long process")
    evaluation = request("POST", f"/v1/competitions/cases/{long_case['id']}/evaluate")
    competition_id = evaluation["competitionId"]
    detail = request("GET", f"/v1/competitions/{competition_id}")
    candidates = {item["employee_id"]: item for item in detail["candidates"]}
    for item in employees[:2]:
        candidate = candidates[item["id"]]
        assert_equal(candidate["eligibility_status"], "ELIGIBLE", "eligible candidate")
        request("PUT", f"/v1/competitions/{competition_id}/candidates/{candidate['id']}/participation", {"accepted": True})
    request("PATCH", f"/v1/competitions/{competition_id}/config", {"minimumScore": 70, "tieBreaker": "SENIORITY"})
    scores = [91, 95]
    for item, score in zip(employees[:2], scores):
        candidate = candidates[item["id"]]
        request("PUT", f"/v1/competitions/{competition_id}/candidates/{candidate['id']}/score", {"score": score, "reason": "E2E initial score"})
    ranking = request("POST", f"/v1/competitions/{competition_id}/rank")["ranking"]
    assert_equal(ranking[0]["employeeId"], employees[1]["id"], "highest exam wins")
    award = request("POST", f"/v1/competitions/{competition_id}/award")
    assert_equal(award["employeeId"], employees[1]["id"], "awarded employee")
    request("POST", f"/v1/coverage-cases/{long_case['id']}/complete")

    print("[7] verify base level remained level 7")
    employee_rows = request("GET", "/v1/employees")["items"]
    by_id = {item["id"]: item for item in employee_rows}
    assert_equal(by_id[employees[1]["id"]]["base_level_id"], level7, "base level invariant")

    print("E2E scenario completed successfully")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"E2E FAILED: {exc}", file=sys.stderr)
        raise
