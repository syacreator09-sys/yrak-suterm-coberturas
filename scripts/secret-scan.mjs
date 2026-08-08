#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
if (git.status !== 0) {
  console.error('FAIL  git ls-files unavailable; cannot perform tracked secret scan');
  process.exit(1);
}

const files = git.stdout.split('\0').filter(Boolean);
const binaryExtensions = new Set(['.png','.jpg','.jpeg','.gif','.webp','.ico','.pdf','.zip','.gz','.woff','.woff2','.ttf','.otf']);
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['OpenAI/Anthropic-style secret', /\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}\b/g],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g],
  ['Hugging Face token', /\bhf_[A-Za-z0-9]{20,}\b/g],
  ['NVIDIA API token', /\bnvapi-[A-Za-z0-9_-]{20,}\b/g],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}\b/g],
];

let failures = 0;
for (const path of files) {
  if (binaryExtensions.has(extname(path).toLowerCase())) continue;
  let text;
  try { text = readFileSync(resolve(root, path), 'utf8'); } catch { continue; }
  for (const [label, regex] of patterns) {
    regex.lastIndex = 0;
    if (regex.test(text)) {
      console.error(`FAIL  possible ${label} in tracked file: ${path}`);
      failures += 1;
    }
  }
}

if (failures) {
  console.error(`Secret scan found ${failures} possible tracked secret occurrence(s). Review before any push/deploy.`);
  process.exit(1);
}
console.log(`PASS  tracked secret scan (${files.length} files inspected by filename/content where text-readable)`);
