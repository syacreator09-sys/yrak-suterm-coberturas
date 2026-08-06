import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [target, environment = 'staging'] = process.argv.slice(2);
if (target !== 'worker' && target !== 'mcp') {
  throw new Error('Uso: pnpm tsx scripts/render-wrangler.ts worker|mcp staging|production');
}
if (!['staging', 'production'].includes(environment)) {
  throw new Error('El ambiente debe ser staging o production');
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable ${name}`);
  return value;
}

const databaseId = required('CLOUDFLARE_D1_DATABASE_ID');
const databaseName = required('CLOUDFLARE_D1_DATABASE_NAME');
const suffix = environment === 'production' ? 'production' : 'staging';

if (target === 'worker') {
  const workerName =
    process.env.CLOUDFLARE_WORKER_NAME?.trim() || `yrak-suterm-coberturas-${suffix}`;
  const queueName = required('CLOUDFLARE_QUEUE_NAME');
  const config = {
    $schema: '../../node_modules/wrangler/config-schema.json',
    name: workerName,
    main: 'src/index.ts',
    compatibility_date: '2026-08-06',
    compatibility_flags: ['nodejs_compat'],
    vars: {
      ENVIRONMENT: environment,
      APP_ORIGIN: required('APP_ORIGIN'),
      EMAIL_FROM: required('EMAIL_FROM'),
      GENERATIVE_PROVIDER: 'openai',
      OPENAI_MODEL: required('OPENAI_MODEL'),
      CF_ACCESS_TEAM_DOMAIN: required('CF_ACCESS_TEAM_DOMAIN'),
      CF_ACCESS_AUD: required('CF_ACCESS_AUD'),
    },
    d1_databases: [
      {
        binding: 'DB',
        database_name: databaseName,
        database_id: databaseId,
        migrations_dir: '../../migrations',
      },
    ],
    r2_buckets: [{ binding: 'EVIDENCE', bucket_name: required('CLOUDFLARE_R2_BUCKET_NAME') }],
    queues: {
      producers: [{ binding: 'PROCESSING_QUEUE', queue: queueName }],
      consumers: [{ queue: queueName, max_batch_size: 5, max_batch_timeout: 10 }],
    },
    ai: { binding: 'AI' },
    durable_objects: { bindings: [{ name: 'GROUP_COORDINATOR', class_name: 'GroupCoordinator' }] },
    migrations: [{ tag: 'v1', new_sqlite_classes: ['GroupCoordinator'] }],
    workflows: [
      {
        name: `yrak-coverage-workflow-${suffix}`,
        binding: 'COVERAGE_WORKFLOW',
        class_name: 'CoverageWorkflow',
      },
    ],
    send_email: [{ name: 'EMAIL' }],
    triggers: { crons: ['*/1 * * * *'] },
    observability: { enabled: true },
  };
  writeFileSync(
    resolve('apps/worker/wrangler.generated.json'),
    `${JSON.stringify(config, null, 2)}\n`,
  );
} else {
  const workerName =
    process.env.CLOUDFLARE_MCP_WORKER_NAME?.trim() || `yrak-suterm-coberturas-mcp-${suffix}`;
  const config = {
    $schema: '../../node_modules/wrangler/config-schema.json',
    name: workerName,
    main: 'src/index.ts',
    compatibility_date: '2026-08-06',
    compatibility_flags: ['nodejs_compat'],
    vars: {
      MCP_ORGANIZATION_ID: required('MCP_ORGANIZATION_ID'),
      MCP_ALLOWED_HOSTNAME: required('MCP_ALLOWED_HOSTNAME'),
    },
    d1_databases: [{ binding: 'DB', database_name: databaseName, database_id: databaseId }],
    observability: { enabled: true },
  };
  writeFileSync(
    resolve('apps/mcp-server/wrangler.generated.json'),
    `${JSON.stringify(config, null, 2)}\n`,
  );
}

console.log(`Configuración ${target}/${environment} generada.`);
