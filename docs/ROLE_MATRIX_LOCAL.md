# YRAK — Local Role Matrix & A/B Isolation

This procedure is **local/synthetic only**. The fixture seeder refuses remote URLs.

Prerequisites:

```bash
bash scripts/bootstrap-local.sh
pnpm verify:rc
bash scripts/migrate-local.sh
pnpm dev:api
```

In a second terminal, initialize the synthetic organization if needed:

```bash
pnpm seed:local
```

Create the authorization fixture intentionally:

```bash
CONFIRM_LOCAL_AUTH_FIXTURE=YES pnpm seed:auth-fixture
```

Synthetic fixture:

- groups `YRAK TEST GROUP A` and `YRAK TEST GROUP B`;
- employee `TEST-A-001` in A and `TEST-B-001` in B;
- ADMIN from the local bootstrap;
- HR;
- AUDITOR;
- SUPERVISOR A;
- SUPERVISOR B;
- COMMITTEE A;
- OPERATOR A;
- EMPLOYEE A.

Then run the read-only matrix:

```bash
pnpm smoke:roles
```

The smoke must prove:

- every synthetic identity resolves to the expected role through `/v1/me`;
- ADMIN/HR/AUDITOR can see both synthetic groups;
- SUPERVISOR A sees A and not B;
- SUPERVISOR B sees B and not A;
- COMMITTEE A sees A and not B;
- OPERATOR A sees A and not B through the reference endpoint;
- EMPLOYEE cannot use the administrative reference endpoint;
- SUPERVISOR/COMMITTEE employee lists contain A, exclude B and expose no employee email;
- OPERATOR and EMPLOYEE cannot access the administrative employee directory.

A passing local matrix is not a substitute for Cloudflare Access staging tests. Remote staging must repeat role/scope verification using real Access-authenticated identities rather than `x-yrak-user-email`.

Do not point `seed-auth-fixture.mjs` at staging or production. It intentionally refuses non-loopback hosts.
