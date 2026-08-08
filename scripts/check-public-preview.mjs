import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = new URL('../apps/admin-web/public-preview/', import.meta.url);
const forbidden = [
  '/v1/',
  'SUPABASE_SECRET_KEY',
  'GOOGLE_OAUTH_REFRESH_TOKEN',
  'AI_COMPAT_API_KEY',
  'ACCESS_AUD',
  'Cf-Access-Jwt-Assertion',
  'x-yrak-user-email',
  'Bearer ',
  'sk-proj-',
  'eyJhbGci',
];

async function files(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await files(path));
    else out.push(path);
  }
  return out;
}

const rootPath = root.pathname;
const paths = await files(rootPath);
if (!paths.length) throw new Error('PUBLIC_PREVIEW_EMPTY');
let sawBanner = false;

for (const path of paths) {
  const text = await readFile(path, 'utf8');
  if (text.includes('Preview visual · datos demo')) sawBanner = true;
  for (const needle of forbidden) {
    if (text.includes(needle)) {
      throw new Error(`PUBLIC_PREVIEW_FORBIDDEN_STRING:${relative(rootPath, path)}:${needle}`);
    }
  }
}

if (!sawBanner) throw new Error('PUBLIC_PREVIEW_BANNER_MISSING');
console.log(JSON.stringify({ ok: true, files: paths.length, apiCalls: 0, secrets: 0 }));
