import { test, expect, conceptFixtureLabels } from './fixtures.js';
import { randomUUID } from 'node:crypto';

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

test('wealth pages paginate real captures and analysis modules retain explicit global scope', /** Independent module failures and a missing account link must not corrupt recorded values or scoped actual reports. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Complete private authentication before fixture-only metadata requests. */ (url) => url.pathname === '/',
  );
  const session = await (await page.request.get('/api/v1/auth/session')).json();
  const headers = { origin: new URL(page.url()).origin, 'x-csrf-token': session.csrfToken };
  for (let index = 0; index < 6; index++) {
    const response = await page.request.post('/api/v1/wealth-records', {
      headers,
      data: { idempotencyKey: `browser-page-${info.project.name}-${index}-${randomUUID()}` },
    });
    expect(response.status()).toBe(201);
  }
  const all = (await (await page.request.get('/api/v1/wealth-records?limit=100')).json()).items;
  await page.goto('/wealth');
  const rows = page.locator('[data-wealth-record]');
  await expect(rows).toHaveCount(5);
  await page.getByRole('button', { name: 'Weitere Aufzeichnungen laden', exact: true }).click();
  await expect(rows).toHaveCount(all.length);
  const ids = await rows.evaluateAll(
    /** Validate actual rendered immutable IDs after cursor append. */ (elements) =>
      elements.map(
        /** Read only the public record identity. */ (element) => element.getAttribute('data-wealth-record'),
      ),
  );
  expect(new Set(ids).size).toBe(all.length);
  const accounts = await (await page.request.get('/api/v1/accounts')).json();
  const checking = accounts.find(
    /** Preserve one actual account scope while opening global observation modules. */ (account: { name: string }) =>
      account.name === conceptFixtureLabels.checking,
  );
  await page.route(
    '**/api/v1/reserve-goal',
    /** Fail only the independent reserve module; actual scoped reports and history stay real. */ async (route) =>
      route.fulfill({
        status: 503,
        json: { error: { code: 'INTERNAL_ERROR', message: 'synthetic', requestId: 'synthetic' } },
      }),
  );
  await page.goto(`/analytics?from=2026-09-01&to=2026-10-31&accountId=${checking.id}`);
  const history = page.locator('[data-analysis-module="history"]');
  const reserve = page.locator('[data-analysis-module="reserve"]');
  await expect(history).toHaveAttribute('data-analysis-scope', 'workspace');
  await expect(history).toContainText('unabhängig vom Umsatzfilter');
  await expect(history).toContainText('9.007.199.254.755.543,01 €');
  await expect(reserve.getByRole('alert')).toBeVisible();
  await expect(page.locator('[data-analysis-module="months"]')).toBeVisible();
  await page.unroute('**/api/v1/reserve-goal');
  await reserve.getByRole('button', { name: 'Erneut versuchen', exact: true }).click();
  await expect(reserve.getByRole('alert')).toHaveCount(0);
  await expect(reserve).toContainText('Unabhängig vom Umsatzfilter');
  expect(
    await page.evaluate(
      /** A long selected account may not increase filter-track or document width. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/concept-wealth-modules-${info.project.name}.png`, fullPage: true });
  await history.getByRole('link').click();
  await expect(page).toHaveURL(/\/wealth$/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`accountId=${checking.id}`));
  const target = all[0];
  const source = target.components.find(
    /** Project an actually retained source label without modifying its captured amount or date. */ (item: {
      sourceLabel: string;
    }) => item.sourceLabel === conceptFixtureLabels.missing,
  );
  await page.route(
    '**/api/v1/wealth-records?*',
    /** Exercise the existing SetNull UI branch; real deletion and preserved values are proved by the database suite. */ async (
      route,
    ) => {
      const response = await route.fetch();
      const body = await response.json();
      for (const record of body.items)
        if (record.id === target.id)
          for (const item of record.components) if (item.id === source.id) item.accountId = null;
      await route.fulfill({ response, json: body });
    },
  );
  await page.goto('/wealth');
  const frozen = page.locator(`[data-wealth-record="${target.id}"]`);
  await frozen.locator('summary').click();
  await expect(frozen).toContainText(conceptFixtureLabels.missing);
  await expect(frozen).toContainText('Quellkonto nicht mehr verknüpft');
  await expect(frozen.getByRole('link', { name: conceptFixtureLabels.missing, exact: true })).toHaveCount(0);
  await page.unroute('**/api/v1/wealth-records?*');
  expect((await (await page.request.get('/api/v1/wealth-records?limit=100')).json()).items).toEqual(all);
});
