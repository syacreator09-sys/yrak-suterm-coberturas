---
name: yrak-verification
description: Run the evidence-first YRAK verification workflow after code/config changes and before claiming a branch is ready, merging, staging or production deployment.
disable-model-invocation: true
---

# YRAK verification gate

Never claim a test/build/deploy passes without fresh command output from the current checkout.

Run in order:

```bash
node scripts/doctor.mjs
pnpm install
node scripts/doctor.mjs --strict
node scripts/check-migrations.mjs
node scripts/secret-scan.mjs
bash scripts/verify-release-candidate.sh
```

Then apply/verify local D1 migrations and run the relevant smoke/E2E scripts from `docs/CLONE_TEST_CONNECT.md`.

Rules:

- A compile pass does not prove runtime behavior.
- A provider smoke test does not prove business rules.
- A Dashboard render does not prove API authorization.
- Do not connect or deploy production while any `REPLACE_WITH_*` placeholder remains in the target environment.
- Do not merge generated `pnpm-lock.yaml` blindly: inspect it, rerun the gate with it present, then commit it.
- If a gate fails, record the failing command/output, fix the root cause, and rerun from the smallest relevant test plus the full gate before declaring success.
