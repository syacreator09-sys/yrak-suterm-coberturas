import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [environment = 'staging'] = process.argv.slice(2);
if (!['staging', 'production'].includes(environment)) {
  throw new Error('El ambiente debe ser staging o production');
}
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable ${name}`);
  return value;
}
const suffix = environment === 'production' ? 'production' : 'staging';
const config = {
  $schema: '../../node_modules/wrangler/config-schema.json',
  name: process.env.CLOUDFLARE_MCP_WORKER_NAME?.trim() || `yrak-suterm-coberturas-mcp-${suffix}`,
  main: 'src/index.ts',
  compatibility_date: '2026-08-06',
  compatibility_flags: ['nodejs_compat'],
  vars: {
    MCP_ORGANIZATION_ID: required('MCP_ORGANIZATION_ID'),
    MCP_ALLOWED_HOSTNAME: required('MCP_ALLOWED_HOSTNAME'),
  },
  d1_databases: [
    {
      binding: 'DB',
      database_name: required('CLOUDFLARE_D1_DATABASE_NAME'),
      database_id: required('CLOUDFLARE_D1_DATABASE_ID'),
    },
  ],
  observability: { enabled: true },
};
writeFileSync(
  resolve('apps/mcp-readonly/wrangler.generated.json'),
  `${JSON.stringify(config, null, 2)}\n`,
);
console.log(`Configuración MCP readonly ${environment} generada.`);
