import { test, expect } from '@playwright/test';

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
    const more = page.locator('.mobile-more');
    await more.locator('summary').click();
    await expect(more).toHaveAttribute('open', '');
    await page.keyboard.press('Escape');
    await expect(more).not.toHaveAttribute('open');
    await expect(more.locator('summary')).toBeFocused();
    await more.locator('summary').click();
    await page.getByRole('heading', { level: 1 }).click();
    await expect(more).not.toHaveAttribute('open');
    await more.locator('summary').click();
    await more.getByRole('link', { name: 'Konten', exact: true }).click();
    await expect(page).toHaveURL(/\/accounts$/);
    await expect(more).not.toHaveAttribute('open');
  }
  await page.goto('/categories?month=2031-03');
  await expect(page.getByRole('heading', { name: 'Kategorien & Auswertung' })).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Kategorien verwalten' }).click();
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
  await expect(page.locator('.category-management')).not.toHaveAttribute('open');
  await page.getByRole('link', { name: 'Buchungen zuordnen', exact: true }).click();
  await expect(page).toHaveURL(/uncategorized=true/);
  await expect(page.getByLabel('Ohne Kategorie', { exact: true })).toBeChecked();
  await page.getByLabel(`Kategorie für ${label}`, { exact: true }).selectOption({ label });
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
  await page.getByLabel('Monat', { exact: true }).fill('2031-04');
  await page.getByLabel('Monat', { exact: true }).press('Tab');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('.spending-panel')).not.toBeVisible();
  await page.unroute('**/api/v1/analytics/monthly?*');
  await page.getByRole('button', { name: 'Aktualisieren', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Noch keine Ausgaben in diesem Monat' })).toBeVisible();
});
