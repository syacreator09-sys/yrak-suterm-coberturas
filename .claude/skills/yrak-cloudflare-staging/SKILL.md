---
name: yrak-cloudflare-staging
description: Connect and validate YRAK Cloudflare staging resources, Access, Workers, D1, R2, Queues, Durable Objects, Workflows and Workers AI without touching production first.
disable-model-invocation: true
---

# YRAK Cloudflare staging

Prerequisites: `/yrak-verification` must pass locally first.

Use a staging-first sequence:

1. Confirm active Cloudflare account and target staging names.
2. Create/resolve D1, R2 and Queue IDs; never guess IDs.
3. Configure Durable Objects and Workflow bindings from the tracked Wrangler files.
4. Apply D1 migrations to staging and inspect output.
5. Configure Cloudflare Access for the staging host.
6. Set `APP_ENV=staging`, `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` to the exact Access application values.
7. Store secrets with Wrangler secret mechanisms/environment controls; never write them into tracked `wrangler.jsonc`, `.env`, docs or prompts.
8. Deploy API, then Agent/MCP/Maintenance workers, then frontends.
9. Run health/readiness, anti-header-spoof, role matrix, group-scope A/B and synthetic E2E tests.
10. Exercise backup/restore/rollback before any production proposal.

Fail closed:

- Remote requests must authenticate through the validated `Cf-Access-Jwt-Assertion`; the email header is not identity authority.
- `x-yrak-user-email` is development-loopback only.
- Do not add wildcard CORS to fix deployment issues.
- Do not weaken CSP/Access/RBAC to make a test pass.
- Do not provision production from this skill unless the user explicitly requests promotion after staging evidence is reviewed.
