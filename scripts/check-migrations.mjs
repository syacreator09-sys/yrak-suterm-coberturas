#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'migrations');
const exceptionPath = resolve(dir, 'sequence-exceptions.json');
const files = readdirSync(dir).filter((name) => name.endsWith('.sql')).sort();
const parsed = files.map((name) => {
  const match = /^(\d{4})[_-]/.exec(name);
  if (!match) return { name, number: null };
  return { name, number: Number(match[1]) };
});

let failures = 0;
for (const item of parsed) {
  if (item.number === null) {
    console.error(`FAIL  migration has no four-digit prefix: ${item.name}`);
    failures += 1;
  }
}

const numbered = parsed.filter((item) => item.number !== null);
const byNumber = new Map();
for (const item of numbered) {
  const list = byNumber.get(item.number) ?? [];
  list.push(item.name);
  byNumber.set(item.number, list);
}
for (const [number, names] of byNumber) {
  if (names.length > 1) {
    console.error(`FAIL  duplicate migration ${String(number).padStart(4, '0')}: ${names.join(', ')}`);
    failures += 1;
  }
}

const numbers = [...byNumber.keys()].sort((a, b) => a - b);
if (!numbers.length) {
  console.error('FAIL  no SQL migrations found');
  process.exit(1);
}

let exceptionEntries = [];
if (existsSync(exceptionPath)) {
  try {
    const body = JSON.parse(readFileSync(exceptionPath, 'utf8'));
    exceptionEntries = Array.isArray(body?.gaps) ? body.gaps : [];
  } catch {
    console.error('FAIL  migrations/sequence-exceptions.json is invalid JSON');
    failures += 1;
  }
}

const exceptions = new Map();
for (const entry of exceptionEntries) {
  const number = Number(entry?.number);
  const reason = typeof entry?.reason === 'string' ? entry.reason.trim() : '';
  if (!Number.isInteger(number) || number <= 0 || reason.length < 20) {
    console.error(`FAIL  invalid migration gap exception: ${JSON.stringify(entry)}`);
    failures += 1;
    continue;
  }
  if (exceptions.has(number)) {
    console.error(`FAIL  duplicate migration gap exception: ${String(number).padStart(4, '0')}`);
    failures += 1;
    continue;
  }
  exceptions.set(number, reason);
}

const gaps = [];
for (let value = numbers[0]; value <= numbers[numbers.length - 1]; value += 1) {
  if (!byNumber.has(value)) gaps.push(value);
}

const unexpectedGaps = gaps.filter((number) => !exceptions.has(number));
if (unexpectedGaps.length) {
  console.error(`FAIL  undocumented migration sequence gap(s): ${unexpectedGaps.map((n) => String(n).padStart(4, '0')).join(', ')}`);
  console.error('      Do not renumber existing applied migrations. Document a verified historical exception or add a forward-only migration when semantically required.');
  failures += 1;
}

for (const number of gaps.filter((value) => exceptions.has(value))) {
  console.log(`PASS  documented historical gap ${String(number).padStart(4, '0')}: ${exceptions.get(number)}`);
}

const staleExceptions = [...exceptions.keys()].filter((number) => !gaps.includes(number));
if (staleExceptions.length) {
  console.error(`FAIL  stale migration gap exception(s) no longer represent a gap: ${staleExceptions.map((n) => String(n).padStart(4, '0')).join(', ')}`);
  failures += 1;
}

if (!gaps.length) {
  console.log(`PASS  migration sequence contiguous: ${String(numbers[0]).padStart(4, '0')}..${String(numbers[numbers.length - 1]).padStart(4, '0')}`);
} else if (!unexpectedGaps.length) {
  console.log(`PASS  migration numbering audited: ${String(numbers[0]).padStart(4, '0')}..${String(numbers[numbers.length - 1]).padStart(4, '0')} with ${gaps.length} documented historical gap(s)`);
}

if (failures) process.exit(1);
