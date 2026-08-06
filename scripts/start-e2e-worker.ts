import { spawn, spawnSync } from 'node:child_process';

function run(args: string[]): void {
  const result = spawnSync('pnpm', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    throw new Error(`Falló: pnpm ${args.join(' ')}`);
  }
}

run([
  'wrangler',
  'd1',
  'migrations',
  'apply',
  'DB',
  '--local',
  '--config',
  'apps/worker/wrangler.jsonc',
]);
run([
  'wrangler',
  'd1',
  'execute',
  'DB',
  '--local',
  '--file',
  'tests/fixtures/e2e-seed.sql',
  '--config',
  'apps/worker/wrangler.jsonc',
]);

const child = spawn(
  'pnpm',
  [
    'wrangler',
    'dev',
    '--config',
    'apps/worker/wrangler.jsonc',
    '--local',
    '--port',
    '8787',
  ],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => child.kill(signal));
}
child.on('exit', (code) => process.exit(code ?? 1));
