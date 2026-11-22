import { choose } from './controls.js';
import { test, expect } from './fixtures.js';

test('private ledger: login, CSV import, categorization, filters, responsive views and logout', /** Exercise real API and database rather than intercepted fixture responses. */ async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on(
    'pageerror',
    /** Collect uncaught browser errors for final acceptance. */ (error) => errors.push(error.message),
  );
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
  await page.goto('/?month=2026-11');
  await expect(page.getByText('Noch kein Saldo', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      /** Catch page-level horizontal overflow at mobile width. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/dashboard-${info.project.name}.png`, fullPage: true });
  await page
    .getByRole('region', { name: 'Letzte Buchungen', exact: true })
    .getByRole('link', { name: 'Alle Umsätze', exact: true })
    .click();
  await expect(page.getByRole('link', { name: /Gehalt November/ })).toBeVisible();
  await page.getByRole('link', { name: 'Analysen', exact: true }).click();
  await page.getByRole('link', { name: 'Kategorien & Regeln', exact: true }).click();
  await page.getByRole('button', { name: 'Kategorien verwalten', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill(`Lebensmittel ${info.project.name}`);
  await page.getByRole('button', { name: 'Kategorie anlegen', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Kategoriename' }).last()).toHaveValue(/Lebensmittel|Wohnen/);
  await page.goto('/imports/csv');
  const label = `Browserimport ${info.project.name} Müller`;
  await page.getByLabel('CSV-Datei', { exact: true }).setInputFiles({
    name: 'sparkasse.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `Datum;Betrag;Text;Bankreferenz\n04.11.2026;-12,34;${label};pw-${info.project.name}\n`,
      'latin1',
    ),
  });
  await expect(page.getByRole('heading', { name: 'Übersicht' })).toBeVisible();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Datei ausgewertet' })
      .or(page.getByRole('status').filter({ hasText: 'Datei ausgewertet' })),
  ).toBeVisible();
  await expect(page).toHaveURL(/month=2026-11/);
  await page.goto('/transactions');
  await page.getByLabel('Umsätze durchsuchen').fill(label);
  await page.getByRole('button', { name: 'Filtern', exact: true }).click();
  await expect(page.getByRole('link', { name: new RegExp(label) })).toBeVisible();
  let releaseRefresh: () => void = () => {};
  let refreshStarted: () => void = () => {};
  const held = new Promise<void>(
    /** Hold only the list response, allowing real detail navigation meanwhile. */ (resolve) => {
      releaseRefresh = resolve;
    },
  );
  const started = new Promise<void>(
    /** Observe the actual post-save list request before clicking its detail. */ (resolve) => {
      refreshStarted = resolve;
    },
  );
  const booking = page.getByRole('dialog', { name: 'Umsatzdetails', exact: true });
  await page.route(
    '**/api/v1/transactions?**',
    /** Keep real response data but deliver it after the user enters a detail. */ async (route) => {
      const response = await route.fetch();
      refreshStarted();
      await held;
      await route.fulfill({ response });
    },
  );
  try {
    await choose(page, page.getByLabel(`Kategorie für ${label}`, { exact: true }), `Lebensmittel ${info.project.name}`);
    await started;
    const link = page.getByRole('link', { name: new RegExp(label) });
    const href = await link.getAttribute('href');
    await link.click();
    await expect(booking).toBeVisible();
    const delivered = page.waitForResponse(
      /** Observe completion of the old list response without arbitrary delays. */ (response) =>
        new URL(response.url()).pathname === '/api/v1/transactions',
    );
    releaseRefresh();
    await delivered;
    await page.waitForLoadState('networkidle');
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(href);
  } finally {
    releaseRefresh();
    await page.unroute('**/api/v1/transactions?**');
  }
  await expect(booking.getByLabel('Kategorie zuordnen', { exact: true })).toHaveText(
    `Lebensmittel ${info.project.name}`,
  );
  await page.route(
    '**/api/v1/transactions/bulk-classification',
    /** A rejected annotation must preserve the chosen draft and the original amount. */ async (route) =>
      route.fulfill({
        status: 503,
        json: { error: { code: 'INTERNAL_ERROR', message: 'synthetic', requestId: 'synthetic' } },
      }),
  );
  await choose(page, page.getByLabel('Fix oder variabel', { exact: true }), 'Fix');
  await page.getByRole('button', { name: 'Kennzeichnung speichern', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Fix oder variabel', { exact: true })).toContainText('Fix');
  await page.unroute('**/api/v1/transactions/bulk-classification');
  await page.getByRole('button', { name: 'Kennzeichnung speichern', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  const annotated = await (await page.request.get(`/api/v1/transactions?search=${encodeURIComponent(label)}`)).json();
  expect(annotated.items[0]).toMatchObject({ classification: 'FIXED', amountCents: '-1234' });
  await page.getByRole('button', { name: 'Als Umbuchung markieren' }).click();
  await expect(page.getByRole('button', { name: 'Umbuchung aufheben' })).toBeVisible();
  await page.goto('/accounts');
  await expect(page.getByRole('heading', { name: 'Konten', exact: true })).toBeVisible();
  await page.goto('/connections');
  await expect(page.getByRole('heading', { name: 'Bankverbindungen', exact: true })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Einstellungen', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
