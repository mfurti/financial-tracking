import { test, expect } from '@playwright/test';

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
  await expect(page.getByRole('heading', { name: 'Finanzieller Überblick' })).toBeVisible();
  await page.goto('/?month=2026-11');
  await expect(page.getByRole('link', { name: /Gehalt November/ })).toBeVisible();
  await expect(page.getByText('Noch kein Saldo', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      /** Catch page-level horizontal overflow at mobile width. */ () =>
        document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/dashboard-${info.project.name}.png`, fullPage: true });
  await page.getByRole('link', { name: 'Kategorien', exact: true }).click();
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
  await expect(page.getByRole('status').filter({ hasText: 'Dateiformat: Windows-1252' })).toBeVisible();
  await page.getByText('Dateiformat anpassen (optional)', { exact: true }).click();
  await page.getByLabel('Kodierung', { exact: false }).selectOption('utf-8');
  await expect(page.getByRole('alert')).toContainText('passt nicht zu den Dateibytes');
  await page.getByLabel('Kodierung', { exact: false }).selectOption('windows-1252');
  await expect(page.getByRole('alert')).not.toBeVisible();
  await expect(page.getByLabel('Kodierung', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Vorschau erstellen' })).toBeEnabled();
  expect(
    await page.evaluate(
      /** Import help must fit the supported narrow viewport. */ () =>
        document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole('link', { name: 'Zum Inhalt springen', exact: true })).not.toBeFocused();
  await page.evaluate(
    /** Capture fixed controls at the actual page top, not the browser's last auto-scroll position. */ () =>
      window.scrollTo(0, 0),
  );
  await page.screenshot({ path: `.local/csv-columns-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Vorschau erstellen' }).click();
  await expect(page.getByRole('heading', { name: 'Vorschau prüfen' })).toBeVisible();
  await expect(page.getByText(label, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Import bestätigen' }).click();
  await expect(page.getByRole('heading', { name: 'Importe & Prüfungen' })).toBeVisible();
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
    await page
      .getByLabel(`Kategorie für ${label}`, { exact: true })
      .selectOption({ label: `Lebensmittel ${info.project.name}` });
    await started;
    const link = page.getByRole('link', { name: new RegExp(label) });
    const href = await link.getAttribute('href');
    await link.click();
    await expect(page.getByRole('heading', { name: 'Umsatzdetails' })).toBeVisible();
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
  await expect(page.getByText(`Lebensmittel ${info.project.name}`, { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Als Umbuchung markieren' }).click();
  await expect(page.getByRole('button', { name: 'Umbuchung aufheben' })).toBeVisible();
  await page.goto('/accounts');
  await expect(page.getByRole('heading', { name: 'Deine Konten', exact: true })).toBeVisible();
  await page.goto('/connections');
  await expect(page.getByRole('heading', { name: 'Bankverbindungen', exact: true })).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Einstellungen', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
