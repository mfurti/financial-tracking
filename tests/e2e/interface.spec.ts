import { test, expect } from './fixtures.js';

test('themes, responsive pages, form errors, retry and session expiry', /** Browser acceptance across the real application plus explicit synthetic error states. */ async ({
  page,
}, info) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
  await page.goto('/login');
  await expect(page.locator('html')).toHaveClass(/dark/);
  const theme = page.getByRole('button', { name: 'Dunkelmodus', exact: true });
  await expect(theme).toHaveCount(1);
  await expect(theme).toHaveAttribute('aria-pressed', 'true');
  await theme.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(theme).toBeFocused();
  await expect(page.locator('.theme-toggle svg')).toHaveCSS('transition-duration', '0.24s');
  const circle = await theme.boundingBox();
  expect(circle).not.toBeNull();
  expect(circle!.width).toBe(circle!.height);
  await expect(theme).toHaveCSS('border-radius', '50%');
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await theme.click();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await theme.click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(page.locator('.theme-toggle svg')).toHaveCSS('transition-duration', '0s');
  await theme.click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
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
    if ((await theme.getAttribute('aria-pressed')) !== String(mode === 'Dunkel')) await theme.click();
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
      ).toBe(mode === 'Dunkel' ? 'rgb(19, 19, 31)' : 'rgb(246, 247, 251)');
      if (path.startsWith('/?'))
        await page.screenshot({ path: `.local/dashboard-${mode}-${info.project.name}.png`, fullPage: true });
    }
  }
  await page.goto('/transactions?from=2026-11-01&to=2026-11-30');
  await page.getByRole('button', { name: 'Von auswählen', exact: true }).click();
  await page.screenshot({ path: `.local/date-picker-${info.project.name}.png` });
  await page.getByRole('button', { name: /15.*November.*2026/ }).click();
  await page.getByRole('button', { name: 'Filtern', exact: true }).click();
  await expect(page).toHaveURL(/from=2026-11-15/);
  await page.getByRole('button', { name: 'Von löschen', exact: true }).click();
  await page.getByRole('button', { name: 'Filtern', exact: true }).click();
  await expect(page).not.toHaveURL(/from=/);
  await page.goto('/accounts');
  await page.getByLabel('Name', { exact: true }).fill('Checksum validation');
  await page.getByLabel('IBAN (optional)', { exact: true }).fill('DE00370400440532013000');
  await page.getByRole('button', { name: 'Konto anlegen', exact: true }).click();
  await expect(page.getByText('Bitte eine gültige deutsche IBAN eingeben.', { exact: true })).toBeVisible();
  await page.goto('/categories');
  await page.getByRole('button', { name: 'Kategorien verwalten', exact: true }).click();
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
  await expect(theme).toHaveAttribute('aria-pressed', 'false');
});
