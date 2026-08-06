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
const queueName = required('CLOUDFLARE_QUEUE_NAME');
const config = {
  $schema: '../../node_modules/wrangler/config-schema.json',
  name: process.env.CLOUDFLARE_WORKER_NAME?.trim() || `yrak-suterm-coberturas-${suffix}`,
  main: 'src/index-final.ts',
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
      database_name: required('CLOUDFLARE_D1_DATABASE_NAME'),
      database_id: required('CLOUDFLARE_D1_DATABASE_ID'),
      migrations_dir: '../../migrations',
    },
  ],
  r2_buckets: [{ binding: 'EVIDENCE', bucket_name: required('CLOUDFLARE_R2_BUCKET_NAME') }],
  queues: {
    producers: [{ binding: 'PROCESSING_QUEUE', queue: queueName }],
    consumers: [{ queue: queueName, max_batch_size: 5, max_batch_timeout: 10 }],
  },
  ai: { binding: 'AI' },
  durable_objects: {
    bindings: [{ name: 'GROUP_COORDINATOR', class_name: 'GroupCoordinator' }],
  },
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
console.log(`Configuración final ${environment} generada.`);
