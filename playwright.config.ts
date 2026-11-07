import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 60000,
  fullyParallel: false,
  use: { baseURL: 'http://localhost:4320', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    {
      command: 'node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/e2e-server.ts',
      url: 'http://localhost:4320/login',
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: 'node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/e2e-server.ts --empty',
      url: 'http://localhost:4322/login',
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
  projects: [
    {
      name: 'desktop',
      testMatch: ['ledger.spec.ts', 'interface.spec.ts', 'bank.spec.ts', 'import-experience.spec.ts'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'mobile',
      testMatch: ['ledger.spec.ts', 'interface.spec.ts', 'bank.spec.ts', 'import-experience.spec.ts'],
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'empty-desktop',
      testMatch: 'accountless.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4322', viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'empty-mobile',
      testMatch: 'accountless.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:4322',
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
