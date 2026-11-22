import { test, expect, conceptFixtureLabels } from './fixtures.js';

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin', colorScheme: 'light', reducedMotion: 'reduce' });
test.beforeEach(
  /** Match the synthetic reference date without changing the real authenticated API clock. */ async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-18T12:00:00Z') });
  },
);

test('merchant and category details retain exact scope, refunds and return navigation', /** Real report-to-booking journeys must never become substring search or lose accountless scope. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(/** Await the real session before opening scoped analysis. */ (url) => url.pathname === '/');
  await page.goto('/analytics?from=2026-10-01&to=2026-10-31');
  const details = page.locator('.finance-full-analysis');
  await details.locator('summary').click();
  await details.getByRole('link', { name: new RegExp(conceptFixtureLabels.merchant) }).click();
  await expect(page).toHaveURL(/analytics\/details\?.*merchantKey=/);
  const detailUrl = page.url();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(conceptFixtureLabels.merchant);
  await expect(page.locator('[data-analysis-total]')).toHaveText('99,99 €');
  await page.screenshot({
    path: `.local/merchant-details-${info.project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      /** Scoped detail rows must stay within the current viewport. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole('link', { name: /Einkauf Oktober/ })).toHaveCount(1);
  await page.getByRole('button', { name: 'Einnahmen anzeigen', exact: true }).click();
  await expect(page.locator('[data-analysis-total]')).toHaveText('2,99 €');
  await expect(page.getByRole('link', { name: /Erstattung Oktober/ })).toHaveCount(1);
  await page.reload();
  await expect(page.locator('[data-analysis-total]')).toHaveText('2,99 €');
  await page.getByRole('link', { name: /Erstattung Oktober/ }).click();
  await expect(page.getByRole('heading', { name: 'Umsatzdetails', exact: true })).toBeVisible();
  const booking = page.getByRole('dialog', { name: 'Umsatzdetails', exact: true });
  await booking.getByRole('button', { name: 'Zur Analyse zurück', exact: true }).click();
  await expect(booking).toBeHidden();
  await expect(page.locator('[data-analysis-total]')).toHaveText('2,99 €');
  await page.goto(detailUrl);
  await page.getByRole('link', { name: 'Alle zugehörigen Umsätze', exact: true }).click();
  await expect(page).toHaveURL(/transactions\?.*merchantKey=/);
  await page.getByRole('button', { name: 'Filtern', exact: true }).click();
  await expect(page.getByRole('link', { name: /Einkauf Oktober/ })).toHaveCount(1);
  await expect(page.getByRole('link', { name: /Kontolose CSV Ausgabe/ })).toHaveCount(0);
  await page.goto('/analytics?from=2026-10-01&to=2026-10-31&unassigned=true');
  await details.locator('summary').click();
  await details.getByRole('link', { name: /Nicht kategorisiert/ }).click();
  await expect(page).toHaveURL(/analytics\/details/);
  await expect(page).toHaveURL(/unassigned=true/);
  await expect(page.locator('[data-analysis-total]')).toHaveText('1,23 €');
});

test('back navigation ignores a superseded income response', /** A late completed aggregate must not overwrite the newer expense bookmark. */ async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(/** Await a real authenticated session. */ (url) => url.pathname === '/');
  const key = `name:${Buffer.from(conceptFixtureLabels.merchant).toString('base64url')}`;
  await page.goto(`/analytics/details?from=2026-10-01&to=2026-10-31&merchantKey=${key}&direction=EXPENSE`);
  await expect(page.locator('[data-analysis-total]')).toHaveText('99,99 €');
  let release!: () => void, arrived!: () => void, completed!: () => void;
  const gate = new Promise<void>(
    /** Hold only the superseded income response. */ (resolve) => {
      release = resolve;
    },
  );
  const started = new Promise<void>(
    /** Observe the actual income request before going back. */ (resolve) => {
      arrived = resolve;
    },
  );
  const finished = new Promise<void>(
    /** Ensure the stale response really completed before the final assertion. */ (resolve) => {
      completed = resolve;
    },
  );
  await page.route(
    '**/api/v1/analytics/overview?*',
    /** Retain real server data and defer only one response's delivery. */ async (route) => {
      if (new URL(route.request().url()).searchParams.get('direction') !== 'INCOME') {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      arrived();
      await gate;
      try {
        await route.fulfill({ response });
      } finally {
        completed();
      }
    },
  );
  await page.getByRole('button', { name: 'Einnahmen anzeigen', exact: true }).click();
  await started;
  try {
    await page.goBack();
    await expect(page.locator('[data-analysis-total]')).toHaveText('99,99 €');
  } finally {
    release();
  }
  await finished;
  await expect(page.locator('[data-analysis-total]')).toHaveText('99,99 €');
  await expect(page.getByRole('button', { name: 'Ausgaben anzeigen', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('unknown merchant, invalid identity and failed reads never show stale or broadened totals', /** Invalid or superseded filters are recoverable without showing a previous scope's data. */ async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Await authenticated data access before testing failure recovery. */ (url) => url.pathname === '/',
  );
  const url = '/analytics/details?from=2026-10-01&to=2026-10-31&merchantKey=unknown&direction=EXPENSE';
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Unbekannter Händler', exact: true })).toBeVisible();
  await expect(page.locator('[data-analysis-total]')).toHaveText('1,23 €');
  await page.goto('/analytics/details?from=2026-10-01&to=2026-10-31&merchantKey=invalid');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('[data-analysis-total]')).toHaveCount(0);
  await page.route(
    '**/api/v1/analytics/overview?*',
    /** Fail the actual aggregate read while preserving authentication. */ async (route) =>
      route.fulfill({
        status: 503,
        json: { error: { code: 'INTERNAL_ERROR', message: 'synthetic', requestId: 'synthetic' } },
      }),
  );
  await page.goto(url);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('[data-analysis-total]')).toHaveCount(0);
  await page.unroute('**/api/v1/analytics/overview?*');
  await page.getByRole('button', { name: 'Erneut versuchen', exact: true }).click();
  await expect(page.locator('[data-analysis-total]')).toHaveText('1,23 €');
});
