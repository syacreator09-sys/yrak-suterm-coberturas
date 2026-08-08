#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const scripts = packageJson.scripts ?? {};
let failures = 0;
let checked = 0;

for (const [name, command] of Object.entries(scripts)) {
  if (typeof command !== 'string') continue;
  const matches = [...command.matchAll(/(?:^|&&|;|\|\|)\s*(?:node|bash)\s+(scripts\/[A-Za-z0-9._/-]+)/g)];
  for (const match of matches) {
    const relative = match[1];
    checked += 1;
    if (!existsSync(resolve(root, relative))) {
      failures += 1;
      console.error(`FAIL  package script ${name} references missing file: ${relative}`);
    } else {
      console.log(`PASS  ${name} -> ${relative}`);
    }
  }
}

if (!checked) {
  console.error('FAIL  no node/bash script file references were detected in package.json');
  process.exit(1);
}
if (failures) process.exit(1);
console.log(`PASS  package script references (${checked} file reference(s))`);
