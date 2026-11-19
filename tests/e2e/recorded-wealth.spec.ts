import { test, expect, conceptFixtureLabels } from './fixtures.js';

test('recorded wealth confirms dated sources and safely retries a lost response', /** Real immutable captures never become inferred bank history or duplicate on a transport retry. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(/** Await the authenticated private workspace. */ (url) => url.pathname === '/');
  const before = await (await page.request.get('/api/v1/transactions?limit=100')).json();
  await page.getByRole('link', { name: 'Mehr', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Weitere Seiten' })
    .getByRole('link', { name: 'Vermögen', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Vermögen', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Aktuelle Quellen', exact: true })).toContainText(
    '9.007.199.254.755.543,01 €',
  );
  await expect(page.getByText('Noch keine Vermögenswerte aufgezeichnet.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Werte aufzeichnen', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Werte aufzeichnen', exact: true });
  await expect(dialog).toContainText(conceptFixtureLabels.missing);
  await expect(dialog).toContainText('Unbekannter Betrag');
  await expect(dialog).toContainText('−450,00 €');
  await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  expect((await (await page.request.get('/api/v1/wealth-records')).json()).items).toHaveLength(0);
  const keys: string[] = [];
  await page.route(
    '**/api/v1/wealth-records',
    /** Lose the response after the actual first capture committed; subsequent retry reaches the same server identity. */ async (
      route,
    ) => {
      if (route.request().method() !== 'POST') return route.continue();
      const body = route.request().postDataJSON();
      expect(Object.keys(body)).toEqual(['idempotencyKey']);
      keys.push(body.idempotencyKey);
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      if (keys.length === 1) await route.abort('failed');
      else await route.fulfill({ response });
    },
  );
  await page.getByRole('button', { name: 'Werte aufzeichnen', exact: true }).click();
  await dialog.getByRole('button', { name: 'Jetzt aufzeichnen', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  const captured = (await (await page.request.get('/api/v1/wealth-records')).json()).items;
  expect(captured).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Jetzt aufzeichnen', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.unroute('**/api/v1/wealth-records');
  const record = page.locator(`[data-wealth-record="${captured[0].id}"]`);
  await expect(record).toContainText('9.007.199.254.755.543,01 €');
  await record.locator('summary').click();
  await expect(record).toContainText('−450,00 €');
  await expect(record).toContainText('Unbekannter Betrag');
  await expect(record).toContainText('10.11.2026');
  await page.reload();
  expect((await (await page.request.get('/api/v1/wealth-records')).json()).items).toEqual(captured);
  await expect(record).toBeVisible();
  expect(await (await page.request.get('/api/v1/transactions?limit=100')).json()).toEqual(before);
  expect(
    await page.evaluate(
      /** Exact huge values and long source labels must wrap without widening the document. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/concept-recorded-wealth-${info.project.name}.png`, fullPage: true });
});
