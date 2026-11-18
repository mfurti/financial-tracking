import { test, expect, conceptFixtureLabels } from './fixtures.js';

test('overview follows device column composition and retains exact actual-month navigation', /** Inspect rendered section ownership and real scoped totals rather than screenshot shape alone. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Preserve the real authenticated flow before choosing a month. */ (url) => url.pathname === '/',
  );
  await page.goto('/?month=2026-11');
  await expect(page.locator('[data-overview-section="bookings"]')).toBeVisible();
  const width = info.project.use.viewport!.width;
  const expected =
    width > 1100
      ? [['bookings'], ['payments', 'accounts'], ['categories']]
      : width > 700
        ? [
            ['bookings', 'accounts'],
            ['payments', 'categories'],
          ]
        : [['bookings', 'payments', 'accounts', 'categories']];
  const order = await page
    .locator('[data-overview-column]')
    .evaluateAll(
      /** Read the actual DOM order and column grouping, including slot-owned sections. */ (columns) =>
        columns.map(
          /** Each section contributes exactly once to the current composition. */ (column) =>
            [...column.querySelectorAll('[data-overview-section]')].map(
              /** Keep assertions independent of translated headings. */ (section) =>
                section.getAttribute('data-overview-section'),
            ),
        ),
    );
  expect(order).toEqual(expected);
  await expect(page.locator('.overview-net')).toHaveText('2.080,10 €');
  await page.getByRole('button', { name: 'Vorheriger Monat', exact: true }).click();
  await expect(page).toHaveURL(/month=2026-10/);
  await expect(page.locator('.overview-net')).toHaveText('2.901,77 €');
  await page.reload();
  await expect(page.locator('.overview-net')).toHaveText('2.901,77 €');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.finance-overview-columns')).toHaveAttribute('data-layout', 'desktop');
  await expect(page.locator('.overview-net')).toHaveText('2.901,77 €');
  await page.setViewportSize(info.project.use.viewport!);
  await expect(page.locator('.finance-overview-columns')).toHaveAttribute(
    'data-layout',
    width > 1100 ? 'desktop' : width > 700 ? 'tablet' : 'mobile',
  );
  const accountCopyWidth = await page
    .locator('[data-overview-section="accounts"] .account-row > div')
    .first()
    .evaluate(
      /** Large exact balances must not collapse the adjacent long account name into character fragments. */ (
        element,
      ) => element.getBoundingClientRect().width,
    );
  expect(accountCopyWidth).toBeGreaterThanOrEqual(150);
  expect(
    await page.evaluate(
      /** Long synthetic labels and exact large balances cannot expand the document. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/concept-overview-${info.project.name}.png`, fullPage: true });
});

test('planned payment widget separates failure, empty plan and recovered real obligations', /** Scope injected errors to the widget, preserving the real actual-month report. */ async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Wait for a valid session before injecting the plan response. */ (url) => url.pathname === '/',
  );
  await page.route(
    '**/api/v1/contracts',
    /** The failure affects planned obligations, never actual income/expenses. */ (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'TEMPORARY', message: 'Plan nicht verfügbar.' }),
      }),
  );
  await page.goto('/?month=2026-11');
  const payments = page.locator('[data-overview-section="payments"]');
  await expect(payments.getByRole('alert')).toBeVisible();
  await expect(payments.locator('.contract-list-row')).toHaveCount(0);
  await expect(page.locator('.overview-net')).toHaveText('2.080,10 €');
  await page.unroute('**/api/v1/contracts');
  let releaseEmpty!: () => void;
  const emptyResponse = new Promise<void>(
    /** Keep retry pending long enough to prove repeated actions are disabled. */ (resolve) => {
      releaseEmpty = resolve;
    },
  );
  await page.route(
    '**/api/v1/contracts',
    /** Empty confirmed plans are distinct from a failed fetch. */ async (route) => {
      await emptyResponse;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    },
  );
  await payments.getByRole('button', { name: 'Erneut laden', exact: true }).click();
  try {
    await expect(payments.getByRole('button', { name: 'Erneut laden', exact: true })).toBeDisabled();
  } finally {
    releaseEmpty();
  }
  await expect(payments).toContainText('Keine anstehenden bestätigten Vertragszahlungen');
  await page.unroute('**/api/v1/contracts');
  await page.reload();
  await expect(payments).toContainText(conceptFixtureLabels.contract);
});

test('overview reserves loading tiles, hides stale amounts on failure and recovers to real and empty data', /** Failure injection verifies UI states; the first case separately proves real financial amounts. */ async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Complete the real session before injecting one report failure. */ (url) => url.pathname === '/',
  );
  let release!: () => void;
  const pending = new Promise<void>(
    /** Hold one response long enough to inspect meaningful pending state. */ (resolve) => {
      release = resolve;
    },
  );
  await page.route(
    '**/api/v1/analytics/monthly*',
    /** Return an explicit synthetic failure after pending-state assertions. */ async (route) => {
      await pending;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'TEMPORARY', message: 'Bericht vorübergehend nicht verfügbar.' }),
      });
    },
  );
  await page.goto('/?month=2026-11');
  try {
    await expect(page.locator('.finance-overview-stats [data-state="loading"]')).toHaveCount(3);
  } finally {
    release();
  }
  await expect(page.getByRole('button', { name: 'Erneut versuchen', exact: true })).toBeVisible();
  await expect(page.locator('.overview-net')).toHaveCount(0);
  await page.unroute('**/api/v1/analytics/monthly*');
  await page.getByRole('button', { name: 'Erneut versuchen', exact: true }).click();
  await expect(page.locator('.overview-net')).toHaveText('2.080,10 €');
  await page.goto('/?month=2026-09');
  await expect(page.locator('[data-overview-section="bookings"]')).toContainText('noch keine Buchungen');
  await expect(page.locator('[data-overview-section="categories"]')).toContainText('Noch keine Ausgaben');
});
