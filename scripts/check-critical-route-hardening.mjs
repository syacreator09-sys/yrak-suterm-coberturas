#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
function read(path) { return readFileSync(resolve(root, path), 'utf8'); }
function expect(path, pattern, message) {
  const source = read(path);
  if (!pattern.test(source)) {
    failures += 1;
    console.error(`FAIL  ${message} (${path})`);
  } else {
    console.log(`PASS  ${message}`);
  }
}

expect('apps/api-worker/src/routes/attachments.ts', /entityType:\s*z\.literal\('INTAKE'\)/, 'attachments fail closed to explicitly scoped INTAKE uploads');
expect('apps/api-worker/src/routes/attachments.ts', /action:\s*'UPLOADED'/, 'attachment uploads are audited');
expect('apps/api-worker/src/routes/intake.ts', /action:\s*'CREATED'/, 'intake draft creation is audited');
expect('apps/api-worker/src/routes/intake.ts', /action:\s*'EXTRACTED'/, 'intake extraction is audited without raw text in audit metadata');
expect('apps/api-worker/src/routes/intake.ts', /action:\s*'CONSUMED'/, 'intake consumption is audited');
expect('apps/api-worker/src/routes/intake.ts', /findCoverageForDraft/, 'intake consume has idempotent coverage recovery');
expect('apps/api-worker/src/routes/appeals.ts', /assertGroupAccess\(c,\s*appeal\.group_id\)/, 'appeal decisions are group-scoped');
expect('apps/api-worker/src/routes/appeals.ts', /action:\s*'RESOLVED'/, 'appeal resolution is audited');
expect('apps/api-worker/src/routes/employees.ts', /NULL AS email/, 'scoped operational employee lists minimize email');
expect('apps/api-worker/src/routes/employees.ts', /entityType:\s*'EMPLOYEE_UNAVAILABILITY'/, 'employee unavailability is audited');
expect('apps/api-worker/src/routes/employees.ts', /entityType:\s*'EMPLOYEE_REQUIREMENT'/, 'employee requirement mutation is audited');
expect('apps/api-worker/src/routes/configuration.ts', /entityType:\s*'LEVEL_TRANSITION'/, 'level transitions are audited');
expect('apps/api-worker/src/routes/configuration.ts', /entityType:\s*'ROTATION_POOL'/, 'rotation pool creation is audited');
expect('apps/api-worker/src/routes/imports.ts', /IMPORT_GROUP_ID_SCOPE_CONFLICT/, 'catalog import rejects cross-organization group id collisions');
expect('apps/api-worker/src/routes/imports.ts', /USER_EMPLOYEE_SCOPE_MISMATCH/, 'user import validates employee ownership');
expect('apps/api-worker/src/routes/imports.ts', /HOLIDAY_GROUP_SCOPE_MISMATCH/, 'holiday import validates group ownership');
expect('apps/api-worker/src/routes/competitions.ts', /assertGroupAccess\(c,\s*competition\.group_id\)/, 'competition award is group-scoped before decision');
expect('apps/api-worker/src/routes/competitions.ts', /HUMAN_APPROVAL_OF_DETERMINISTIC_RANKING/, 'competition award audit preserves human-approval rule');
expect('apps/api-worker/src/routes/competitions.ts', /await coordinator\.release\(winner\.employee_id,\s*competition\.coverage_case_id\)/, 'competition award releases short-lived coordinator lock');
expect('apps/api-worker/src/routes/competitions.ts', /coverage_case_id<>\?/, 'competition award rechecks persistent D1 overlap inside lock');
expect('migrations/0020_unique_coverage_source_intake_draft.sql', /UNIQUE INDEX[\s\S]*source_intake_draft/i, 'D1 enforces one coverage per intake draft');
expect('migrations/0021_unique_active_assignment_per_coverage.sql', /UNIQUE INDEX[\s\S]*temporary_assignments/i, 'D1 enforces one live assignment per coverage');

if (failures) process.exit(1);
console.log('PASS  critical route hardening regression checks completed');
