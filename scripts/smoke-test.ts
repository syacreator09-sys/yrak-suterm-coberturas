const baseUrl = process.env.APP_ORIGIN?.replace(/\/$/, '');
if (!baseUrl) throw new Error('Falta APP_ORIGIN');

async function assertJson(path: string, expectedStatus: number): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
  if (response.status !== expectedStatus) {
    throw new Error(`${path}: se esperaba ${expectedStatus}, se recibió ${response.status}`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`${path}: respuesta no JSON (${contentType})`);
  }
  return response.json();
}

const health = (await assertJson('/health', 200)) as { status?: string };
if (health.status !== 'ok') throw new Error('/health no reportó ok');
const ready = (await assertJson('/ready', 200)) as { status?: string };
if (ready.status !== 'ready') throw new Error('/ready no reportó ready');

const protectedResponse = await fetch(`${baseUrl}/api/v1/dashboard`, { redirect: 'manual' });
if (![302, 401, 403].includes(protectedResponse.status)) {
  throw new Error(`Dashboard sin protección: HTTP ${protectedResponse.status}`);
}
console.log('Smoke test correcto: health, ready y protección de API.');
