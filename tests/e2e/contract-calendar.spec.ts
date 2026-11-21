import { test, expect, conceptFixtureLabels } from './fixtures.js';
import { choose } from './controls.js';

test('contract calendar keeps exact month-end plans, scope and failure recovery', /** Read only isolated real schedule data through reload and direct contract navigation. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(/** Complete the real session before reading private plans. */ (url) => url.pathname === '/');
  const before = await (await page.request.get('/api/v1/transactions?limit=100')).json();
  await page.goto('/contracts/calendar?month=2036-02');
  await expect(page.getByRole('heading', { level: 1, name: 'Vertragskalender' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Geplante Fälligkeiten im Monat' })).toContainText('59,00 €');
  const event = page.locator('[data-calendar-event]').filter({ hasText: conceptFixtureLabels.contract });
  await expect(event).toContainText('29.02.2036');
  await expect(event).toContainText('Keine Buchung zugeordnet');
  const date = page.getByRole('button', { name: '29.02.2036 · 1 Fälligkeiten', exact: true });
  await date.focus();
  await page.keyboard.press('Enter');
  await expect(date).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Alle Fälligkeiten zeigen', exact: true }).click();
  await page.getByRole('button', { name: 'Nächster Monat', exact: true }).click();
  await expect(event).toContainText('31.03.2036');
  await expect(page).toHaveURL(/month=2036-03/);
  await page.getByRole('button', { name: 'Vorheriger Monat', exact: true }).click();
  await expect(event).toContainText('29.02.2036');
  await choose(page, page.getByRole('button', { name: 'Kalenderkonto', exact: true }), conceptFixtureLabels.missing);
  await expect(page.getByRole('region', { name: 'Geplante Fälligkeiten im Monat' })).toContainText('0,00 €');
  await expect(page.getByText('Keine Fälligkeiten im gewählten Zeitraum.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Geplante Fälligkeiten im Monat' })).toContainText('0,00 €');
  await choose(page, page.getByRole('button', { name: 'Kalenderkonto', exact: true }), 'Alle Konten');
  await expect(event).toBeVisible();
  await page.route(
    '**/api/v1/contracts/calendar?*',
    /** Fail the changed-month read without replacing any actual data. */ async (route) =>
      route.fulfill({
        status: 503,
        json: { error: { code: 'INTERNAL_ERROR', message: 'synthetic', requestId: 'synthetic' } },
      }),
  );
  await page.getByRole('button', { name: 'Nächster Monat', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Geplante Fälligkeiten im Monat' })).toHaveCount(0);
  await page.unroute('**/api/v1/contracts/calendar?*');
  await page.getByRole('button', { name: 'Erneut laden', exact: true }).click();
  await expect(event).toContainText('31.03.2036');
  expect(
    await page.evaluate(
      /** Detect genuine document overflow without clipping financial values. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/concept-calendar-${info.project.name}.png`, fullPage: true });
  await event.getByRole('link', { name: conceptFixtureLabels.contract, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: conceptFixtureLabels.contract })).toBeVisible();
  await page.goBack();
  await expect(event).toContainText('31.03.2036');
  expect(await (await page.request.get('/api/v1/transactions?limit=100')).json()).toEqual(before);
  await page.goto('/contracts/calendar?month=invalid');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Geplante Fälligkeiten im Monat' })).toHaveCount(0);
});
