// Test-only stand-in for the 'cloudflare:workers' runtime module, which only
// exists inside the Workers runtime. Vitest runs in Node, so this shim lets
// session.test.ts import session.ts (which statically imports DurableObject
// from 'cloudflare:workers') without pulling in the full Workers test pool.
export class DurableObject<Env = unknown> {
  ctx: unknown;
  env: Env;
  constructor(ctx: unknown, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
}
