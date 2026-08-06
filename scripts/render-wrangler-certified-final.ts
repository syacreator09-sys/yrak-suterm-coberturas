import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

await import('./render-wrangler-certified.js');
const path = resolve('apps/worker/wrangler.generated.json');
const config = JSON.parse(readFileSync(path, 'utf8')) as { main: string };
config.main = 'src/index-certified-final.ts';
writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
console.log('Entrypoint certified-final configurado.');
