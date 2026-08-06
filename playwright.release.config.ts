import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e-release',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8787',
    extraHTTPHeaders: {
      'x-test-user': 'E2E-ADMIN',
      'x-test-organization': 'ORG-DEMO',
      'x-test-roles': 'ADMIN,HR,SUPERVISOR,COMMITTEE',
      'x-test-groups': 'GROUP-E2E',
      'x-test-email': 'e2e-admin@example.com',
    },
  },
  webServer: {
    command: 'pnpm tsx scripts/start-e2e-worker.ts',
    url: 'http://127.0.0.1:8787/health',
    timeout: 120_000,
    reuseExistingServer: false,
  },
  reporter: [['list']],
});
