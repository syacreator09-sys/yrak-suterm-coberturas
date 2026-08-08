#!/usr/bin/env node
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'migrations');
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

const gaps = [];
for (let value = numbers[0]; value <= numbers[numbers.length - 1]; value += 1) {
  if (!byNumber.has(value)) gaps.push(value);
}
if (gaps.length) {
  console.error(`FAIL  migration sequence gap(s): ${gaps.map((n) => String(n).padStart(4, '0')).join(', ')}`);
  console.error('      Do not renumber existing applied migrations. Inspect history and add a forward-only migration or document an intentional exception before release.');
  failures += 1;
} else {
  console.log(`PASS  migration sequence contiguous: ${String(numbers[0]).padStart(4, '0')}..${String(numbers[numbers.length - 1]).padStart(4, '0')}`);
}

if (failures) process.exit(1);
