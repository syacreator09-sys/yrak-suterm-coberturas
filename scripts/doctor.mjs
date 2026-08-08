#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
let failures = 0;
let warnings = 0;

function pass(message) { console.log(`PASS  ${message}`); }
function warn(message) { warnings += 1; console.warn(`WARN  ${message}`); }
function fail(message) { failures += 1; console.error(`FAIL  ${message}`); }
function read(path) { return readFileSync(join(root, path), 'utf8'); }
function command(name, args = []) {
  return spawnSync(name, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
}

console.log('== YRAK clone doctor ==');

const packageJson = JSON.parse(read('package.json'));
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor >= 22) pass(`Node ${process.version}`);
else fail(`Node >=22 required; found ${process.version}`);

const expectedPnpm = String(packageJson.packageManager ?? '');
if (expectedPnpm === 'pnpm@10.15.0') pass(`packageManager pinned: ${expectedPnpm}`);
else warn(`packageManager differs from expected pnpm@10.15.0: ${expectedPnpm || 'missing'}`);

const pnpm = command('pnpm', ['--version']);
if (pnpm.status === 0) pass(`pnpm ${pnpm.stdout.trim()}`);
else fail('pnpm is unavailable. Run corepack enable, then retry.');

const requiredPaths = [
  'pnpm-workspace.yaml',
  'turbo.json',
  'AGENTS.md',
  'CLAUDE.md',
  '.mcp.json',
  'docs/CLONE_TEST_CONNECT.md',
  'docs/RELEASE_CANDIDATE_AUDIT.md',
  'apps/admin-web/package.json',
  'apps/api-worker/package.json',
  'apps/agent-worker/package.json',
  'apps/mcp-worker/package.json',
  'apps/maintenance-worker/package.json',
  'apps/employee-portal/package.json',
  'packages/rag/package.json',
  'supabase/rag-schema.template.sql',
  'apps/api-worker/wrangler.jsonc',
  'apps/agent-worker/wrangler.jsonc',
  'apps/mcp-worker/wrangler.jsonc',
  '.claude/skills/yrak-domain-guardrails/SKILL.md',
  '.claude/skills/yrak-verification/SKILL.md',
  '.claude/skills/yrak-cloudflare-staging/SKILL.md',
  '.claude/skills/yrak-mcp-readonly/SKILL.md',
  '.claude/skills/yrak-ai-router/SKILL.md',
  '.claude/skills/yrak-rag-connectors/SKILL.md',
  '.claude/agents/yrak-auditor.md',
  '.claude/agents/yrak-test-runner.md',
  '.claude/agents/yrak-code-reviewer.md',
  '.claude/agents/yrak-cloudflare-integrator.md',
  'scripts/check-architecture-boundaries.mjs',
  'scripts/check-migrations.mjs',
  'scripts/secret-scan.mjs',
  'scripts/render-supabase-rag-schema.mjs',
  'scripts/verify-release-candidate.sh',
  'scripts/migrate-local.sh',
];
for (const path of requiredPaths) {
  if (existsSync(join(root, path))) pass(`required file: ${path}`);
  else fail(`missing required file: ${path}`);
}

const lockPath = join(root, 'pnpm-lock.yaml');
if (existsSync(lockPath)) pass('pnpm-lock.yaml present');
else if (strict) fail('pnpm-lock.yaml missing. Run pnpm install and review/commit the generated lockfile before release.');
else warn('pnpm-lock.yaml missing. First pnpm install will generate it; it must be reviewed before release.');

const git = command('git', ['rev-parse', '--is-inside-work-tree']);
if (git.status === 0 && git.stdout.trim() === 'true') {
  const branch = command('git', ['branch', '--show-current']).stdout.trim();
  if (branch) pass(`git branch: ${branch}`);
  if (branch === 'main') warn('You are on main. Use ready/clone-test-connect-v1 for validation before merging.');
  const tracked = command('git', ['ls-files']).stdout.split(/\r?\n/).filter(Boolean);
  const forbiddenTracked = tracked.filter((path) =>
    /(^|\/)\.dev\.vars(?:\.|$)/.test(path) ||
    (/(^|\/)\.env(?:\.|$)/.test(path) && !path.endsWith('.env.example')) ||
    path.endsWith('settings.local.json') ||
    path === 'supabase/rag-schema.generated.sql'
  );
  if (forbiddenTracked.length) fail(`secret-bearing/generated local files tracked: ${forbiddenTracked.join(', ')}`);
  else pass('no tracked local secret/generated RAG files');
} else {
  warn('git metadata unavailable; tracked-secret filename check skipped');
}

const browserFiles = [
  'apps/admin-web/src',
  'apps/admin-web/public',
  'apps/admin-web/index.html',
];
const serverSecretNames = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'AI_COMPAT_API_KEY',
  'RAG_EMBEDDING_API_KEY',
  'HUGGINGFACE_TOKEN',
  'UPSTASH_REDIS_REST_TOKEN',
  'SUPABASE_SERVICE_ROLE',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'MODAL_API_TOKEN',
  'GMAIL_CLIENT_SECRET',
  'BOOTSTRAP_TOKEN',
  'MCP_API_TOKEN',
  'AGENT_API_TOKEN',
].join('|');
const grep = command('grep', ['-RInE', serverSecretNames, ...browserFiles]);
if (grep.status === 1) pass('browser sources do not reference server secret names');
else if (grep.status === 0) fail(`browser/server-secret boundary violation:\n${grep.stdout.trim()}`);
else warn('grep unavailable; browser secret-name scan skipped');

for (const path of ['apps/api-worker/wrangler.jsonc', 'apps/agent-worker/wrangler.jsonc', 'apps/mcp-worker/wrangler.jsonc']) {
  if (!existsSync(join(root, path))) continue;
  const matches = read(path).match(/REPLACE_WITH_[A-Z0-9_]+/g) ?? [];
  if (matches.length) warn(`${path} still has ${new Set(matches).size} connection placeholder(s); expected before provisioning, forbidden before staging deploy.`);
  else pass(`${path} has no REPLACE_WITH_* placeholders`);
}

console.log(`\nDoctor result: ${failures} failure(s), ${warnings} warning(s).`);
if (failures) process.exit(1);
