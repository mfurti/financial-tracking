import { test, expect } from './fixtures.js';

test('demo account actions conserve cash and plans execute an explicit month once', /** Creation, transfer, plan CRUD and execution stay synthetic across cancellation and reload. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Finish authentication before tracking demo-only mutations. */ (url) => url.pathname === '/',
  );
  const mutations: string[] = [];
  page.on(
    'request',
    /** Count writes without logging request payloads or credentials. */ (request) => {
      if (request.url().includes('/api/v1/') && !['GET', 'HEAD'].includes(request.method()))
        mutations.push(request.url());
    },
  );
  await page.goto('/wealth');
  const portfolio = page.getByRole('region', { name: 'Investment-Demo', exact: true });
  await portfolio.getByRole('button', { name: 'Demo-Konto anlegen', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Demo-Konto anlegen', exact: true });
  await dialog.getByLabel('Demo-Name', { exact: true }).fill('Demo Urlaubskonto mit langem Namen');
  await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(portfolio).not.toContainText('Demo Urlaubskonto mit langem Namen');
  await portfolio.getByRole('button', { name: 'Demo-Konto anlegen', exact: true }).click();
  await dialog.getByLabel('Demo-Name', { exact: true }).fill('Demo Urlaubskonto mit langem Namen');
  await dialog.getByRole('button', { name: 'Demo-Aktion speichern', exact: true }).click();
  await expect(dialog).toBeHidden();
  const accounts = portfolio.getByRole('region', { name: 'Demo-Verrechnungskonten', exact: true });
  await expect(accounts).toContainText('Demo Urlaubskonto mit langem Namen');
  await expect(accounts).toContainText('0,00 €');
  await portfolio.getByRole('button', { name: 'Demo-Geld verschieben', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Demo-Geld verschieben', exact: true });
  await dialog.getByLabel('Nach Demo-Konto', { exact: true }).selectOption('demo-cash');
  await dialog.getByLabel('Demo-Betrag in Euro', { exact: true }).fill('25,01');
  await dialog.getByRole('button', { name: 'Demo-Aktion speichern', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Verschiedene Demo-Konten wählen.');
  await dialog
    .getByLabel('Nach Demo-Konto', { exact: true })
    .selectOption({ label: 'Demo Urlaubskonto mit langem Namen' });
  await dialog.getByRole('button', { name: 'Demo-Aktion speichern', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(accounts).toContainText('9.974,99 €');
  await expect(accounts).toContainText('25,01 €');
  await expect(portfolio.getByRole('region', { name: 'Simuliertes Gesamtvermögen', exact: true })).toContainText(
    '13.734,50 €',
  );
  await portfolio.getByRole('button', { name: 'Demo-Kategorie anlegen', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Demo-Kategorie anlegen', exact: true });
  await dialog.getByLabel('Demo-Name', { exact: true }).fill('Demo Langfristig');
  await dialog.getByRole('button', { name: 'Demo-Aktion speichern', exact: true }).click();
  await expect(dialog).toBeHidden();
  await portfolio.getByText('Demo-Kategorien anzeigen', { exact: true }).click();
  await expect(portfolio.getByText('Demo Langfristig', { exact: true })).toBeVisible();
  await portfolio.getByRole('link', { name: 'Demo-Sparpläne', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Demo-Sparpläne', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Demo-Sparplan anlegen', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Demo-Sparplan bearbeiten', exact: true });
  await dialog.getByLabel('Demo-Planname', { exact: true }).fill('Mein Demo-Sparplan');
  await dialog.getByLabel('Demo-Sparbetrag in Euro', { exact: true }).fill('0');
  await dialog.getByRole('button', { name: 'Demo-Sparplan speichern', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Positiven Demo-Sparbetrag eingeben.');
  await dialog.getByLabel('Demo-Sparbetrag in Euro', { exact: true }).fill('200');
  await dialog.getByLabel('Demo-Ausführungstag', { exact: true }).fill('32');
  await dialog.getByRole('button', { name: 'Demo-Sparplan speichern', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Ausführungstag von 1 bis 31 eingeben.');
  await dialog.getByLabel('Demo-Ausführungstag', { exact: true }).fill('1');
  await dialog.getByRole('button', { name: 'Demo-Sparplan speichern', exact: true }).click();
  await expect(dialog).toBeHidden();
  const row = page.locator('[data-demo-plan]');
  await expect(row).toContainText('Mein Demo-Sparplan');
  await page.reload();
  await expect(row).toContainText('200,00 €');
  await row.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await dialog.getByLabel('Demo-Planname', { exact: true }).fill('Verworfener Name');
  await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(row).toContainText('Mein Demo-Sparplan');
  await row.getByRole('button', { name: 'Monat simulieren', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Demo-Monat simulieren', exact: true });
  await dialog.getByLabel('Demo-Ausführungsmonat', { exact: true }).fill('2026-01');
  await dialog.getByRole('button', { name: 'Diesen Demo-Monat ausführen', exact: true }).click();
  await expect(dialog).toBeHidden();
  await row.getByRole('button', { name: 'Monat simulieren', exact: true }).click();
  await dialog.getByRole('button', { name: 'Diesen Demo-Monat ausführen', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('bereits ausgeführt');
  await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await row.getByRole('button', { name: 'Löschen', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Demo-Sparplan löschen', exact: true });
  await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Löschen', exact: true }).click();
  await dialog.getByRole('button', { name: 'Demo-Sparplan löschen', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toHaveCount(0);
  await page.getByRole('link', { name: 'Zurück zu Vermögen', exact: true }).click();
  await expect(portfolio).toContainText('11 ganze Anteile');
  await expect(portfolio).toContainText('13.734,50 €');
  await portfolio.getByRole('link', { name: 'Demo-Aktivität', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Demo-Aktivität', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Demo-Sparplan ausgeführt', exact: true })).toHaveCount(1);
  await expect(page.getByText('1 ganze Anteile · 123,45 € simulierter Auftragswert', { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Demo Verrechnungskonto → Demo Urlaubskonto mit langem Namen · 25,01 € simuliert/),
  ).toBeVisible();
  expect(mutations).toEqual([]);
  expect(
    await page.evaluate(
      /** Long synthetic names wrap within every selected viewport. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/concept-demo-activity-${info.project.name}.png`, fullPage: true });
});
