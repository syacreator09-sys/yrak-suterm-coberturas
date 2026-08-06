import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

await import('./render-wrangler-enterprise.js');
const path = resolve('apps/worker/wrangler.generated.json');
const config = JSON.parse(readFileSync(path, 'utf8')) as { main: string };
config.main = 'src/index-production-ready.ts';
writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
console.log('Entrypoint production-ready configurado.');
