import { test, expect } from '@playwright/test';

test('themes, responsive pages, form errors, retry and session expiry', /** Browser acceptance across the real application plus explicit synthetic error states. */ async ({
  page,
}, info) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/login');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('button', { name: 'Darstellung: System', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Darstellung: Hell', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Darstellung: Dunkel', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.screenshot({ path: `.local/login-dark-${info.project.name}.png`, fullPage: true });
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Finanzieller Überblick' })).toBeVisible();
  await page.goto('/?month=2026-11');
  await expect(page.getByRole('heading', { name: 'Finanzieller Überblick' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Zum Inhalt springen' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  for (const mode of ['Dunkel', 'Hell']) {
    await page.getByRole('button', { name: `Darstellung: ${mode}`, exact: true }).click();
    for (const path of [
      '/?month=2026-11',
      '/transactions',
      '/accounts',
      '/categories',
      '/imports',
      '/imports/csv',
      '/connections',
      '/settings',
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(
          /** Detect page-wide overflow rather than hiding it with CSS. */ () =>
            document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await page.evaluate(
          /** Require the shared surfaces and text to follow the active theme. */ () =>
            getComputedStyle(document.body).backgroundColor,
        ),
      ).toBe(mode === 'Dunkel' ? 'rgb(16, 25, 22)' : 'rgb(245, 246, 243)');
      if (path.startsWith('/?'))
        await page.screenshot({ path: `.local/dashboard-${mode}-${info.project.name}.png`, fullPage: true });
    }
  }
  await page.goto('/accounts');
  await page.getByLabel('Name', { exact: true }).fill('Checksum validation');
  await page.getByLabel('IBAN (optional)', { exact: true }).fill('DE00370400440532013000');
  await page.getByRole('button', { name: 'Konto anlegen', exact: true }).click();
  await expect(page.getByText('Bitte eine gültige deutsche IBAN eingeben.', { exact: true })).toBeVisible();
  await page.goto('/categories');
  const category = `Retry ${info.project.name}`;
  await page.getByLabel('Name', { exact: true }).fill(category);
  await page.route(
    '**/api/v1/categories',
    /** Inject only a rejected server validation response; successful persistence stays real. */ async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await route.fulfill({
        status: 400,
        json: {
          error: {
            code: 'INVALID_INPUT',
            message: 'Eingabe prüfen.',
            requestId: 'synthetic',
            details: { fields: [{ path: 'name', code: 'custom' }] },
          },
        },
      });
    },
  );
  await page.getByRole('button', { name: 'Kategorie anlegen', exact: true }).click();
  await expect(page.getByText('Bitte Eingabe prüfen.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(category);
  await page.unroute('**/api/v1/categories');
  await page.getByLabel('Name', { exact: true }).fill(`${category} corrected`);
  await expect(page.getByText('Bitte Eingabe prüfen.', { exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Kategorie anlegen', exact: true }).click();
  await expect(
    page.getByRole('textbox', { name: 'Kategoriename', exact: true }).filter({ visible: true }).last(),
  ).toBeVisible();
  await expect
    .poll(
      /** Read the actual persisted result after retry. */ async () =>
        (await (await page.request.get('/api/v1/categories')).json()).some(
          /** Match the persisted user draft after the real retry. */ (entry: { name: string }) =>
            entry.name === `${category} corrected`,
        ),
    )
    .toBe(true);
  await page.context().clearCookies();
  await page.getByRole('link', { name: 'Übersicht', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Darstellung: Hell', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
