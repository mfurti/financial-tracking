import { test, expect } from './fixtures.js';

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
  expect(
    await page.evaluate(
      /** Long synthetic labels and exact large balances cannot expand the document. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/concept-overview-${info.project.name}.png`, fullPage: true });
});
