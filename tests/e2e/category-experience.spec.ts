import { choose } from './controls.js';
import { test, expect } from './fixtures.js';

test('monthly categories explain real expenses and lead to persisted assignments', /** Verify the complete real upload-to-category journey and responsive navigation. */ async ({
  page,
}, info) => {
  const label = `Category journey ${info.project.name}`;
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Finanzieller Überblick' })).toBeVisible();
  if (info.project.name === 'mobile') {
    const more = page.getByRole('button', { name: 'Mehr', exact: true });
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(more).toBeFocused();
    await more.click();
    await page.getByRole('heading', { level: 1 }).click();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await more.click();
    await page
      .getByRole('navigation', { name: 'Weitere Seiten' })
      .getByRole('link', { name: 'Konten', exact: true })
      .click();
    await expect(page).toHaveURL(/\/accounts$/);
    await expect(more).toHaveAttribute('aria-expanded', 'false');
  }
  await page.goto('/categories?month=2031-03');
  await expect(page.getByRole('heading', { name: 'Kategorien & Auswertung' })).toBeVisible();
  await page.getByRole('button', { name: 'Kategorien verwalten', exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill(label);
  await page.getByRole('button', { name: 'Kategorie anlegen', exact: true }).click();
  await expect
    .poll(
      /** Category order is alphabetical, not creation order. */ () =>
        page
          .getByRole('textbox', { name: 'Kategoriename' })
          .evaluateAll(
            /** Read the actual edited fields. */ (inputs) =>
              inputs.map(/** Preserve each displayed name. */ (input) => (input as HTMLInputElement).value),
          ),
    )
    .toContain(label);
  await page.goto('/imports/csv');
  await page.getByLabel('CSV-Datei', { exact: true }).setInputFiles({
    name: 'category-example.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`Datum;Betrag;Text;Bankreferenz\n12.03.2031;-42,25;${label};category-${info.project.name}\n`),
  });
  await expect(page).toHaveURL(/month=2031-03/);
  await expect(page.getByRole('img', { name: /Ausgaben in/ })).toBeVisible();
  await page.screenshot({ path: `.local/experience-dashboard-${info.project.name}.png`, fullPage: true });
  await page.goto('/categories?month=2031-03');
  await expect(page.getByText('So entstehen deine Kategorien', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kategorien verwalten', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.getByRole('link', { name: 'Buchungen zuordnen', exact: true }).click();
  await expect(page).toHaveURL(/uncategorized=true/);
  await expect(page.getByLabel('Ohne Kategorie', { exact: true })).toBeChecked();
  await choose(page, page.getByLabel(`Kategorie für ${label}`, { exact: true }), label);
  await expect(page.getByRole('link', { name: new RegExp(label) })).not.toBeVisible();
  await page.goto('/categories?month=2031-03');
  const category = page.locator('.spending-row').filter({ hasText: label });
  await expect(category).toContainText('42,25');
  const report = await (await page.request.get('/api/v1/analytics/monthly?month=2031-03')).json();
  expect(
    report.categories.find(/** Match the real newly assigned group. */ (row: { name: string }) => row.name === label)
      .expenseCents,
  ).toBe('4225');
  expect(
    await page.evaluate(
      /** Detect genuine overflow on the completed screen. */ () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(/** Capture the full page from its actual top. */ () => window.scrollTo(0, 0));
  await page.screenshot({ path: `.local/experience-categories-${info.project.name}.png`, fullPage: true });
  await category.click();
  await expect(page).toHaveURL(/categoryId=/);
  await expect(page.getByRole('link', { name: new RegExp(label) })).toBeVisible();
  await page.goto('/categories?month=2031-03');
  await expect(page.locator('.spending-row').filter({ hasText: label })).toBeVisible();
  await page.route(
    '**/api/v1/analytics/monthly?*',
    /** Fail only the changed-month read to verify stale totals disappear. */ async (route) => {
      await route.fulfill({
        status: 503,
        json: { error: { code: 'INTERNAL_ERROR', message: 'synthetic', requestId: 'synthetic' } },
      });
    },
  );
  await page.getByRole('button', { name: 'Monat', exact: true }).click();
  await page.getByRole('button', { name: /April/ }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.spending-panel')).not.toBeVisible();
  await page.unroute('**/api/v1/analytics/monthly?*');
  await page.getByRole('button', { name: 'Aktualisieren', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Noch keine Ausgaben in diesem Monat' })).toBeVisible();
  await page.goto('/categories?month=2031-03');
  await page.getByRole('button', { name: 'Kategorien verwalten', exact: true }).click();
  const managed = page.getByRole('group', { name: `Kategorie ${label}`, exact: true });
  await managed.getByRole('button', { name: 'Löschen', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Kategorie löschen?', exact: true });
  await confirmation.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  await managed.getByRole('button', { name: 'Löschen', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Kategorie löschen', exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  const preserved = await (await page.request.get(`/api/v1/transactions?search=${encodeURIComponent(label)}`)).json();
  expect(preserved.items).toHaveLength(1);
  expect(preserved.items[0].categoryId).toBeNull();
  expect(preserved.items[0].amountCents).toBe('-4225');
  await page.getByRole('button', { name: 'Kategorienvorlagen hinzufügen', exact: true }).click();
  await page.getByRole('button', { name: 'Vorlagen hinzufügen', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Kategorie Mode', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Regel erstellen', exact: true }).click();
  const ruleDialog = page.getByRole('dialog', { name: 'Regel erstellen', exact: true });
  await ruleDialog.getByLabel('Regelname', { exact: true }).fill(`Mode ${info.project.name}`);
  await choose(page, ruleDialog.getByLabel('Zielkategorie', { exact: true }), 'Mode');
  await choose(page, ruleDialog.getByLabel('Vergleich', { exact: true }), 'Buchungstext enthält');
  const ruleText = `Automatik-${info.project.name}`;
  await ruleDialog.getByLabel('Gesuchter Text', { exact: true }).fill(ruleText);
  await ruleDialog.getByRole('button', { name: 'Regel speichern', exact: true }).click();
  await expect(ruleDialog).not.toBeVisible();
  await page.goto('/imports/csv');
  await page.getByLabel('CSV-Datei', { exact: true }).setInputFiles({
    name: 'rule-example.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`Datum;Betrag;Text;Bankreferenz\n12.05.2032;-19,25;${ruleText};rule-${info.project.name}\n`),
  });
  await expect(page).toHaveURL(/month=2032-05/);
  await page.goto(`/transactions?search=${ruleText}`);
  await expect(page.getByLabel(`Kategorie für ${ruleText}`, { exact: true })).toContainText('Mode');
  await expect(page.getByRole('link', { name: new RegExp(ruleText) })).toContainText(
    `Regel: Mode ${info.project.name}`,
  );
  await page.getByRole('link', { name: new RegExp(ruleText) }).click();
  await choose(page, page.getByLabel('Kategorie zuordnen', { exact: true }), 'Nicht kategorisiert');
  await choose(page, page.getByLabel('Fix oder variabel', { exact: true }), 'Variabel');
  await page.getByRole('button', { name: 'Kennzeichnung speichern', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Fix oder variabel', { exact: true })).toContainText('Variabel');
  await page.goto('/categories');
  await page.getByRole('button', { name: 'Regeln auf Bestandsbuchungen anwenden', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Bestandsbuchungen neu zuordnen?', exact: true })
    .getByRole('button', { name: 'Jetzt anwenden', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: 'Bestandsbuchungen neu zuordnen?', exact: true })).not.toBeVisible();
  const protectedRow = await (await page.request.get(`/api/v1/transactions?search=${ruleText}`)).json();
  expect(protectedRow.items[0].categoryId).toBeNull();
  expect(protectedRow.items[0].categoryOrigin).toBe('MANUAL');
  expect(protectedRow.items[0].classification).toBe('VARIABLE');
});
