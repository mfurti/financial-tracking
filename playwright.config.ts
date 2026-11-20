import { defineConfig, devices } from '@playwright/test';
import { conceptViewports } from './scripts/concept-viewports.js';

const requestedProjects: string[] = process.env.E2E_BATCH_PROJECTS
  ? JSON.parse(process.env.E2E_BATCH_PROJECTS)
  : process.argv.flatMap(
      /** Start only owned servers for explicitly selected projects; the default full suite retains every project. */ (
        value,
        index,
      ) =>
        value === '--project'
          ? [process.argv[index + 1] ?? '']
          : value.startsWith('--project=')
            ? [value.slice('--project='.length)]
            : [],
    );
/** Preserve Playwright project wildcard selection when deciding which test servers are required. */
function selectedProject(name: string) {
  return (
    requestedProjects.length === 0 ||
    requestedProjects.some(
      /** Match exact project names or the supported wildcard form without interpreting arbitrary regular expressions. */ (
        pattern,
      ) =>
        new RegExp(
          `^${pattern
            .split('*')
            .map(
              /** Quote regex punctuation in each literal project-name segment. */ (part) =>
                part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            )
            .join('.*')}$`,
        ).test(name),
    )
  );
}

/** Concept-only scenarios receive their own fixtures and cannot mutate the existing browser projects. */
const conceptTests = [
  'visual-primitives.spec.ts',
  'concept-*.spec.ts',
  'merchant-drilldown.spec.ts',
  'analysis-modules.spec.ts',
  'reserve-goal.spec.ts',
  'recorded-wealth.spec.ts',
  'contract-calendar.spec.ts',
  'demo-*.spec.ts',
  'workspace-*.spec.ts',
  'account-groups.spec.ts',
  'notifications.spec.ts',
  'custom-appearance.spec.ts',
  'local-roles.spec.ts',
];

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 60000,
  fullyParallel: false,
  use: {
    actionTimeout: 10000,
    baseURL: 'http://localhost:4320',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
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
    {
      command: 'node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/e2e-server.ts --mobile',
      url: 'http://localhost:4324/login',
      reuseExistingServer: false,
      timeout: 120000,
    },
    ...conceptViewports.map(
      /** Allocate distinct mutable data and login limits for each viewport project. */ (profile) => ({
        command: `node node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/e2e-server.ts --concept-width=${profile.width}`,
        url: `http://localhost:${profile.webPort}/login`,
        reuseExistingServer: false,
        timeout: 120000,
      }),
    ),
  ].filter(
    /** Share the existing empty server only between its two empty projects; other profiles own distinct ports. */ (
      server,
    ) => {
      if (server.url === 'http://localhost:4320/login') return selectedProject('desktop');
      if (server.url === 'http://localhost:4322/login')
        return selectedProject('empty-desktop') || selectedProject('empty-mobile');
      if (server.url === 'http://localhost:4324/login') return selectedProject('mobile');
      return conceptViewports.some(
        /** Include only a selected profile's explicit URL, never a guessed port. */ (profile) =>
          server.url === `http://localhost:${profile.webPort}/login` && selectedProject(profile.name),
      );
    },
  ),
  projects: [
    ...conceptViewports.map(
      /** Browser state, server ports and mutable records are owned by the selected project. */ (profile) => ({
        name: profile.name,
        testMatch: conceptTests,
        use: {
          ...devices['Desktop Chrome'],
          baseURL: `http://localhost:${profile.webPort}`,
          viewport: { width: profile.width, height: profile.height },
          isMobile: profile.touch,
          hasTouch: profile.touch,
        },
      }),
    ),
    {
      name: 'desktop',
      testMatch: [
        'ledger.spec.ts',
        'interface.spec.ts',
        'bank.spec.ts',
        'import-experience.spec.ts',
        'appearance.spec.ts',
        'category-experience.spec.ts',
        'contracts.spec.ts',
        'analytics.spec.ts',
      ],
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'mobile',
      testMatch: [
        'ledger.spec.ts',
        'interface.spec.ts',
        'bank.spec.ts',
        'import-experience.spec.ts',
        'appearance.spec.ts',
        'category-experience.spec.ts',
        'contracts.spec.ts',
        'analytics.spec.ts',
      ],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:4324',
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
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
