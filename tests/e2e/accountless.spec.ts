import { choose } from './controls.js';
import { test, expect } from './fixtures.js';

test('CSV without accounts, later assignment and explicit overlap review', /** Exercise the real first-run UI and API without intercepted data. */ async ({
  page,
}, info) => {
  const label = `Kontolos ${info.project.name}`;
  const reference = `source-${info.project.name}`;
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Finanzieller Überblick' })).toBeVisible();
  const accounts = await page.request.get('/api/v1/accounts');
  // The second project shares the test instance after the first project has created one real account.
  if (info.project.name === 'empty-desktop') expect(await accounts.json()).toEqual([]);
  /** Import an explicitly selected CSV without choosing or creating an account. */
  async function upload(amount = '-10,00') {
    await page.goto('/imports/csv');

    await page.getByLabel('CSV-Datei', { exact: true }).setInputFiles({
      name: 'standalone.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`Datum;Betrag;Text;Bankreferenz\n01.11.2026;${amount};${label};${reference}\n`),
    });
    await expect(page).not.toHaveURL(/imports\/csv/);
    if (new URL(page.url()).pathname !== '/imports') await page.goto('/imports');
    await expect(page.getByRole('heading', { name: 'Importhistorie' })).toBeVisible();
  }
  await upload();
  await page.goto('/transactions?unassigned=true');
  await expect(page.getByRole('link', { name: new RegExp(label) })).toBeVisible();
  await choose(page, page.getByLabel(`Kategorie für ${label}`, { exact: true }), 'Lebensmittel');
  const report = await page.request.get('/api/v1/analytics/monthly?month=2026-11');
  expect(BigInt((await report.json()).expenseCents)).toBeGreaterThanOrEqual(1000n);
  await page.goto('/connections');
  await page.getByLabel('Name', { exact: true }).fill(`CSV Quelle ${info.project.name}`);
  await page.getByRole('button', { name: 'Verbindung anlegen', exact: true }).click();
  await expect(page.getByText(`CSV Quelle ${info.project.name}`, { exact: true })).toBeVisible();
  await page.goto('/accounts');
  await page.getByLabel('Name', { exact: true }).fill(`Ziel ${info.project.name}`);
  await page.getByRole('button', { name: 'Konto anlegen', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Kontoname' }).last()).toHaveValue(new RegExp(`Ziel|Sparkasse`));
  await page.goto('/transactions?unassigned=true');
  await page.getByRole('link', { name: new RegExp(label) }).click();
  const assignment = page.getByRole('region', { name: 'Kontozuordnung' });
  await choose(page, assignment.getByLabel('Zielkonto für Zuordnung', { exact: true }), `Ziel ${info.project.name}`);
  await assignment.getByRole('button', { name: 'Zuordnung vergleichen', exact: true }).click();
  await expect(assignment.getByText('Keine mögliche Überschneidung gefunden.', { exact: true })).toBeVisible();
  await assignment.getByRole('button', { name: 'Zuordnung bestätigen', exact: true }).click();
  await expect(assignment).toBeHidden();

  await upload();
  await choose(page, page.getByLabel('Bekannte Buchung auswählen', { exact: true }), { index: 1 });
  await page.getByRole('button', { name: 'Vorhandene Daten behalten', exact: true }).click();
  await expect(page.getByText('Keine offenen Hinweise für diesen Import.', { exact: true })).toBeVisible();
  await upload('-11,00');
  await choose(page, page.getByLabel('Bekannte Buchung auswählen', { exact: true }), { index: 1 });
  await page.getByRole('button', { name: 'Importdaten übernehmen', exact: true }).click();
  await expect(page.getByText('Keine offenen Hinweise für diesen Import.', { exact: true })).toBeVisible();
  const transactions = await page.request.get(`/api/v1/transactions?search=${encodeURIComponent(label)}`);
  const records = (await transactions.json()).items;
  expect(records).toHaveLength(1);
  expect(records[0].amountCents).toBe('-1100');
  expect(records[0].categoryId).not.toBeNull();
  await upload('-11,00');
  await page.getByRole('button', { name: 'Überspringen', exact: true }).click();
  await expect(page.getByText('Keine offenen Hinweise für diesen Import.', { exact: true })).toBeVisible();
  const final = await page.request.get(`/api/v1/transactions?search=${encodeURIComponent(label)}`);
  expect((await final.json()).items).toHaveLength(1);
  await upload('-11,00');
  await page.getByRole('button', { name: 'Separat behalten', exact: true }).click();
  await expect(page.getByText('Keine offenen Hinweise für diesen Import.', { exact: true })).toBeVisible();
  await page.goto(`/transactions?unassigned=true&search=${encodeURIComponent(label)}`);
  await page.getByRole('link', { name: new RegExp(label) }).click();
  await choose(page, assignment.getByLabel('Zielkonto für Zuordnung', { exact: true }), `Ziel ${info.project.name}`);
  await assignment.getByRole('button', { name: 'Zuordnung vergleichen', exact: true }).click();
  await choose(page, assignment.getByRole('button', { name: `Zielbuchung für ${label}`, exact: true }), { index: 1 });
  await choose(
    page,
    assignment.getByRole('combobox', { name: `Entscheidung für ${label}`, exact: true }),
    'Bank-/Zieldaten übernehmen und zusammenführen',
  );
  await assignment.getByRole('button', { name: 'Zuordnung bestätigen', exact: true }).click();
  await expect(assignment).toBeHidden();
  const consolidated = await page.request.get(`/api/v1/transactions?search=${encodeURIComponent(label)}`);
  expect((await consolidated.json()).items).toHaveLength(1);
});
