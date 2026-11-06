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
  const label = `Browserimport ${info.project.name}`;
  await page.getByLabel('CSV-Datei', { exact: true }).setInputFiles({
    name: 'sparkasse.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`Datum;Betrag;Text;Bankreferenz\n04.11.2026;-12,34;${label};pw-${info.project.name}\n`),
  });
  await page.getByRole('button', { name: 'Vorschau erstellen' }).click();
  await expect(page.getByRole('heading', { name: 'Vorschau prüfen' })).toBeVisible();
  await expect(page.getByText(label, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Import bestätigen' }).click();
  await expect(page.getByRole('heading', { name: 'Importe & Prüfungen' })).toBeVisible();
  await page.goto('/transactions');
  await page.getByLabel('Umsätze durchsuchen').fill(label);
  await page.getByRole('button', { name: 'Filtern', exact: true }).click();
  await expect(page.getByRole('link', { name: new RegExp(label) })).toBeVisible();
  await page
    .getByLabel(`Kategorie für ${label}`, { exact: true })
    .selectOption({ label: `Lebensmittel ${info.project.name}` });
  await page.getByRole('link', { name: new RegExp(label) }).click();
  await expect(page.getByRole('heading', { name: 'Umsatzdetails' })).toBeVisible();
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
