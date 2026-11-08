import { test, expect } from '@playwright/test';

test('confirmed recurring payments keep real bookings, expose contract badges and roll future due dates', /** Upload repeated payments, review the suggestion and preserve source data through unlink/delete. */ async ({
  page,
}, info) => {
  const provider = `Vertragsanbieter-${info.project.name}`;
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Finanzieller Überblick' })).toBeVisible();
  await page.goto('/imports/csv');
  await page.getByLabel('CSV-Datei', { exact: true }).setInputFiles({
    name: 'recurring.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `Datum;Betrag;Text;Begünstigter/Zahlungspflichtiger;Bankreferenz\n31.01.2033;-12,34;Vertrag Januar;${provider};${provider}-1\n28.02.2033;-12,34;Vertrag Februar;${provider};${provider}-2\n`,
    ),
  });
  await expect(page).toHaveURL(/month=2033-02/);
  await page.goto('/contracts');
  await expect(page.getByRole('heading', { name: 'Verträge', exact: true })).toBeVisible();
  const proposal = page.locator('.editable-row').filter({ hasText: provider });
  await expect(proposal).toContainText('2 passende Zahlungen');
  await proposal.getByRole('button', { name: 'Vorschlag prüfen', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Vertragsvorschlag bestätigen', exact: true });
  await expect(dialog.getByLabel('Anbieter / Gegenpartei', { exact: true })).toHaveValue(provider);
  await expect(dialog.getByLabel('Betrag in Euro', { exact: true })).toHaveValue('12,34');
  await dialog.getByRole('button', { name: 'Vertrag bestätigen', exact: true }).click();
  await expect(page).toHaveURL(/\/contracts\/[a-f0-9-]+$/);
  await expect(page.getByRole('heading', { level: 1, name: provider })).toBeVisible();
  const contractPath = new URL(page.url()).pathname;
  await page.screenshot({ path: `.local/contracts-${info.project.name}.png`, fullPage: true });
  await expect(page.getByRole('link', { name: 'Automatisch zugeordnet', exact: true })).toHaveCount(2);
  const payments = await (
    await page.request.get(`/api/v1${contractPath}/payments?from=2033-01-01&to=2033-03-31`)
  ).json();
  expect(payments.payments).toHaveLength(2);
  await page.goto('/transactions?from=2033-01-01&to=2033-02-28');
  await expect(page.getByRole('link', { name: provider, exact: true })).toHaveCount(2);
  const rowId = payments.payments[0].transactionId;
  const original = await (await page.request.get(`/api/v1/transactions/${rowId}`)).json();
  expect(original.effectiveClassification).toBe('FIXED');
  await page.goto(contractPath);
  await page.getByRole('button', { name: 'Zuordnung entfernen', exact: true }).first().click();
  const unlink = page.getByRole('dialog', { name: 'Zahlungszuordnung entfernen?', exact: true });
  await unlink.getByRole('button', { name: 'Zuordnung entfernen', exact: true }).click();
  await expect(unlink).not.toBeVisible();
  const preserved = await (await page.request.get(`/api/v1/transactions/${rowId}`)).json();
  expect(preserved.amountCents).toBe(original.amountCents);
  expect(preserved.contractAutoBlocked).toBe(true);
  await page.getByRole('button', { name: 'Vertrag löschen', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Vertrag löschen?', exact: true })
    .getByRole('button', { name: 'Vertrag endgültig löschen', exact: true })
    .click();
  await expect(page).toHaveURL(/\/contracts$/);
  expect((await page.request.get(`/api/v1/transactions/${rowId}`)).status()).toBe(200);
});
