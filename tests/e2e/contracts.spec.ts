import { test, expect } from './fixtures.js';
import { choose } from './controls.js';

test('confirmed recurring payments keep real bookings, expose contract badges and roll future due dates', /** Upload repeated payments, review the suggestion and preserve source data through unlink/delete. */ async ({
  page,
}, info) => {
  const provider = `Vertragsanbieter-${info.project.name}`;
  const otherProvider = `Späteranbieter-${info.project.name}`;
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Finanzieller Überblick' })).toBeVisible();
  await page.goto('/contracts');
  await page.getByRole('button', { name: 'Vertrag anlegen', exact: true }).click();
  const costDialog = page.getByRole('dialog', { name: 'Vertrag anlegen', exact: true });
  await expect(costDialog).toHaveClass(/finance-dialog/);
  await costDialog.getByLabel('Vertragsname', { exact: true }).fill(`Jahreskosten ${info.project.name}`);
  await costDialog.getByLabel('Anbieter / Gegenpartei', { exact: true }).fill(`Jahresanbieter ${info.project.name}`);
  await costDialog.getByLabel('Betrag in Euro', { exact: true }).fill('120,00');
  await choose(page, costDialog.getByLabel('Zahlungsrhythmus', { exact: true }), 'Jährlich');
  await costDialog.getByRole('button', { name: 'Vertrag bestätigen', exact: true }).click();
  await expect(page).toHaveURL(/\/contracts\/[a-f0-9-]+$/);
  const originalContract = await (await page.request.get(`/api/v1${new URL(page.url()).pathname}`)).json();
  await page.getByRole('button', { name: 'Vertrag bearbeiten', exact: true }).click();
  const editDialog = page.getByRole('dialog', { name: 'Vertrag bearbeiten', exact: true });
  await expect(editDialog.getByLabel('Betrag in Euro', { exact: true })).toHaveCount(0);
  const editedName = `Jahreskosten ${info.project.name} geprüft`;
  await editDialog.getByLabel('Vertragsname', { exact: true }).fill(editedName);
  await page.route(
    '**/api/v1/contracts/*',
    /** Reject an explicit metadata save without changing historical rules or the local draft. */ async (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 503,
            json: { error: { code: 'INTERNAL_ERROR', message: 'synthetic', requestId: 'synthetic' } },
          })
        : route.continue(),
  );
  await editDialog.getByRole('button', { name: 'Vertrag speichern', exact: true }).click();
  await expect(editDialog.getByRole('alert')).toBeVisible();
  await expect(editDialog.getByLabel('Vertragsname', { exact: true })).toHaveValue(editedName);
  expect((await (await page.request.get(`/api/v1/contracts/${originalContract.id}`)).json()).name).toBe(
    originalContract.name,
  );
  await page.unroute('**/api/v1/contracts/*');
  await editDialog.getByRole('button', { name: 'Vertrag speichern', exact: true }).click();
  await expect(editDialog).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: editedName, exact: true })).toBeVisible();
  expect((await (await page.request.get(`/api/v1/contracts/${originalContract.id}`)).json()).revisions).toEqual(
    originalContract.revisions,
  );
  await page.goto('/contracts');
  const costCard = page.getByRole('region', { name: 'Ausgaben / Monat', exact: true }).getByRole('link');
  await expect(costCard).toContainText('10,00');
  await costCard.click();
  await expect(page).toHaveURL(/\/contracts\/analysis$/);
  await expect(page.getByRole('heading', { name: 'Vertragsanalyse', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Ohne Kategorie/ }).click();
  await expect(page.getByRole('link', { name: new RegExp(`Jahreskosten ${info.project.name}`) })).toContainText(
    '10,00',
  );
  await page.getByRole('radio', { name: 'Vertragsarten', exact: true }).check();
  await expect(page.getByRole('button', { name: /Abo/ })).toBeVisible();
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        /** All cost panels must fit the real client width. */ () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: info.project.name === 'mobile' ? 360 : 1440, height: 900 });
  await page.screenshot({ path: `.local/contract-analysis-${info.project.name}.png`, fullPage: true });
  await page.goto('/imports/csv');
  await page.getByLabel('CSV-Datei', { exact: true }).setInputFiles({
    name: 'recurring.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `Datum;Betrag;Text;Begünstigter/Zahlungspflichtiger;Bankreferenz\n31.01.2033;-12,34;Vertrag Januar;${provider};${provider}-1\n28.02.2033;-12,34;Vertrag Februar;${provider};${provider}-2\n15.01.2033;-18,90;Andere Zahlung Januar;${otherProvider};${otherProvider}-1\n15.02.2033;-18,90;Andere Zahlung Februar;${otherProvider};${otherProvider}-2\n`,
    ),
  });
  await expect(page).toHaveURL(/month=2033-02/);
  await page.goto('/contracts');
  await expect(page.getByRole('heading', { name: 'Verträge', exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Vorschläge prüfen · 2', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Vertragsvorschläge prüfen', exact: true });
  await expect(dialog.getByLabel('Anbieter / Gegenpartei', { exact: true })).toHaveValue(otherProvider);
  await dialog.getByRole('button', { name: 'Später', exact: true }).click();
  await expect(dialog.getByLabel('Anbieter / Gegenpartei', { exact: true })).toHaveValue(provider);
  await dialog.getByRole('button', { name: 'Prüfung schließen', exact: true }).click();
  await page.getByRole('button', { name: 'Vorschläge prüfen · 2', exact: true }).click();
  await expect(dialog.getByLabel('Anbieter / Gegenpartei', { exact: true })).toHaveValue(otherProvider);
  await dialog.getByLabel('Vertragsname', { exact: true }).fill('Ungespeicherter Entwurf');
  await dialog.getByRole('button', { name: 'Prüfung schließen', exact: true }).click();
  const closeDiscard = page.getByRole('dialog', { name: 'Ungespeicherte Änderungen', exact: true });
  await closeDiscard.getByRole('button', { name: 'Weiter bearbeiten', exact: true }).click();
  await dialog.getByRole('button', { name: 'Nächste Karte', exact: true }).click();
  const discard = page.getByRole('dialog', { name: 'Ungespeicherte Änderungen', exact: true });
  await discard.getByRole('button', { name: 'Weiter bearbeiten', exact: true }).click();
  await expect(dialog.getByLabel('Vertragsname', { exact: true })).toHaveValue('Ungespeicherter Entwurf');
  await dialog.getByRole('button', { name: 'Nächste Karte', exact: true }).click();
  await discard.getByRole('button', { name: 'Änderungen verwerfen', exact: true }).click();
  await expect(dialog.getByLabel('Anbieter / Gegenpartei', { exact: true })).toHaveValue(provider);
  await dialog.getByRole('button', { name: 'Vorherige Karte', exact: true }).click();
  await expect(dialog.getByLabel('Anbieter / Gegenpartei', { exact: true })).toHaveValue(otherProvider);
  const swipeZone = dialog.locator('.review-swipe-zone').first();
  await swipeZone.scrollIntoViewIfNeeded();
  await swipeZone.hover();
  const zone = await swipeZone.boundingBox();
  expect(zone).not.toBeNull();
  await page.mouse.move(zone!.x + zone!.width * 0.85, zone!.y + zone!.height / 2);
  await page.mouse.down();
  await page.mouse.move(zone!.x + zone!.width * 0.15, zone!.y + zone!.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect(dialog.getByLabel('Anbieter / Gegenpartei', { exact: true })).toHaveValue(provider);
  expect(await (await page.request.get('/api/v1/contracts')).json()).toHaveLength(1);
  await dialog.getByRole('button', { name: 'Vorherige Karte', exact: true }).click();
  await dialog.getByRole('button', { name: 'Kein Vertrag', exact: true }).click();
  await expect(dialog.getByLabel('Anbieter / Gegenpartei', { exact: true })).toHaveValue(provider);
  await dialog.getByRole('button', { name: 'Prüfung schließen', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Ausgeblendete Vorschläge', exact: true }).click();
  await dialog.getByRole('button', { name: 'Wiederherstellen', exact: true }).click();
  await expect(dialog.getByLabel('Anbieter / Gegenpartei', { exact: true })).toHaveValue(otherProvider);
  await dialog.getByRole('button', { name: 'Kein Vertrag', exact: true }).click();
  await expect(dialog.getByLabel('Anbieter / Gegenpartei', { exact: true })).toHaveValue(provider);
  await expect(dialog.getByLabel('Betrag in Euro', { exact: true })).toHaveValue('12,34');
  await dialog.getByRole('heading', { name: provider, exact: true }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('heading', { name: 'Vertragsvorschläge prüfen', exact: true })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Prüfung schließen', exact: true })).toBeInViewport();
  await page.screenshot({ path: `.local/contract-review-${info.project.name}.png` });
  await page.route(
    '**/api/v1/contracts',
    /** Lose only the successful confirmation response to exercise safe retry. */ async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await route.fetch();
      await route.abort('failed');
    },
  );
  await dialog.getByRole('button', { name: 'Bestätigen & weiter', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  expect(await (await page.request.get('/api/v1/contracts')).json()).toHaveLength(2);
  await page.unroute('**/api/v1/contracts');
  await dialog.getByRole('button', { name: 'Bestätigen & weiter', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Prüfrunde abgeschlossen', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Verträge anzeigen', exact: true }).click();
  expect(await (await page.request.get('/api/v1/contracts')).json()).toHaveLength(2);
  await page.getByRole('link', { name: new RegExp(provider) }).click();
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
