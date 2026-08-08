#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dimensions = Number(process.env.RAG_EMBEDDING_DIMENSIONS ?? '');
if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 2000) {
  console.error('RAG_EMBEDDING_DIMENSIONS must be an integer from 1 to 2000 for a pgvector HNSW vector index.');
  process.exit(2);
}

const templatePath = resolve(root, 'supabase/rag-schema.template.sql');
const outputPath = resolve(root, 'supabase/rag-schema.generated.sql');
const template = readFileSync(templatePath, 'utf8');
const placeholder = '__RAG_EMBEDDING_DIMENSIONS__';
if (!template.includes(placeholder)) {
  console.error('Supabase RAG schema template is missing the dimensions placeholder.');
  process.exit(1);
}
const sql = template.replaceAll(placeholder, String(dimensions));
if (sql.includes(placeholder)) {
  console.error('Supabase RAG schema rendering left unresolved placeholders.');
  process.exit(1);
}
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, sql, { encoding: 'utf8', mode: 0o600 });
console.log(`Generated ${outputPath} for ${dimensions} embedding dimensions.`);
console.log('Review the SQL before applying it to the intended Supabase project. The generated file is ignored by Git.');
