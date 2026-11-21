import { test, expect, conceptFixtureLabels } from './fixtures.js';

test('reserve goal and explicit Tagesgeld designation persist with honest observed coverage', /** Failed metadata saves retain drafts and never modify imported financial sources. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(/** Await the real private session before reserve reads. */ (url) => url.pathname === '/');
  const before = await (await page.request.get('/api/v1/transactions?limit=100')).json();
  await page.goto('/accounts');
  await page.getByRole('link', { name: 'Reserve & Vermögen', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Beobachtete Reserve', exact: true })).toContainText(
    'Keine beobachtete Reserve',
  );
  await page.goto('/accounts');
  await page.locator('[data-account-card]').filter({ hasText: conceptFixtureLabels.savings }).getByRole('link').click();
  const designation = page.getByRole('checkbox', {
    name: 'Dieses Konto ausdrücklich als Tagesgeld für die Reserve markieren.',
    exact: true,
  });
  await expect(designation).not.toBeChecked();
  await designation.check();
  await page.route(
    '**/api/v1/accounts/*/presentation',
    /** Reject only explicit metadata writes without changing the selected draft. */ async (route) =>
      route.fulfill({
        status: 503,
        json: { error: { code: 'INTERNAL_ERROR', message: 'synthetic', requestId: 'synthetic' } },
      }),
  );
  await page.getByRole('button', { name: 'Reserve-Zuordnung speichern', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(designation).toBeChecked();
  await page.unroute('**/api/v1/accounts/*/presentation');
  await page.getByRole('button', { name: 'Reserve-Zuordnung speichern', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Beobachtete Reserve', exact: true })).toContainText('15.000,00 €');
  await page.getByRole('button', { name: 'Reserveziel bearbeiten', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Reserveziel bearbeiten', exact: true });
  await dialog.getByLabel('Reserveziel in Euro', { exact: true }).fill('0');
  await dialog.getByRole('button', { name: 'Reserveziel speichern', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByLabel('Reserveziel in Euro', { exact: true }).fill('4321,09');
  await page.route(
    '**/api/v1/reserve-goal',
    /** Reject a target change while retaining real reads. */ async (route) =>
      route.request().method() === 'PUT'
        ? route.fulfill({
            status: 503,
            json: { error: { code: 'INTERNAL_ERROR', message: 'synthetic', requestId: 'synthetic' } },
          })
        : route.continue(),
  );
  await dialog.getByRole('button', { name: 'Reserveziel speichern', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Reserveziel in Euro', { exact: true })).toHaveValue('4321,09');
  await page.unroute('**/api/v1/reserve-goal');
  await dialog.getByRole('button', { name: 'Reserveziel speichern', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Beobachtete Reserve', exact: true })).toContainText('4.321,09 €');
  await expect(designation).toBeChecked();
  await page.goto('/accounts');
  await page.locator('[data-account-card]').filter({ hasText: conceptFixtureLabels.missing }).getByRole('link').click();
  await designation.check();
  await page.getByRole('button', { name: 'Reserve-Zuordnung speichern', exact: true }).click();
  const reserve = page.getByRole('region', { name: 'Beobachtete Reserve', exact: true });
  await expect(reserve).toContainText('1 von 2');
  await expect(reserve).toContainText('15.000,00 €');
  await expect(reserve.getByText('1 Quelle älter als 48 Stunden', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reservequellen anzeigen', exact: true }).click();
  await expect(page.getByText('Kein beobachteter gebuchter Saldo', { exact: true })).toBeVisible();
  const goal = await (await page.request.get('/api/v1/reserve-goal')).json();
  expect(goal).toMatchObject({
    targetCents: '432109',
    currentCents: '1500000',
    coverage: 'PARTIAL',
    eligibleCount: 2,
    observedCount: 1,
  });
  expect(await (await page.request.get('/api/v1/transactions?limit=100')).json()).toEqual(before);
  expect(
    await page.evaluate(
      /** Detect genuine long-source-label overflow at the selected viewport. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/concept-reserve-${info.project.name}.png`, fullPage: true });
});
