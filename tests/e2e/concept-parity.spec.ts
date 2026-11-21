import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('concept parity interactions and rendered review captures', async ({ page }, info) => {
  test.setTimeout(120000);
  const width = info.project.use.viewport!.width;
  const colorScheme = process.env.FEATURE_PARITY_SCHEME === 'light' ? 'light' : 'dark';
  if (width === 768) await page.setViewportSize({ width, height: 1024 });
  await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/');
  await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${colorScheme}\\b`));
  const captureDirectory = colorScheme === 'light' ? '.local/concept-parity-light' : '.local/concept-parity';
  await mkdir(captureDirectory, { recursive: true });
  const capture = async (view: string) => {
    if (!view.endsWith('-dialog')) await page.evaluate(() => scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await page.screenshot({
      path: `${captureDirectory}/${width}-app-${view}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  };
  async function closeDialog() {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.goto('/?month=2026-11');
  await expect(page.locator('[data-overview-section="bookings"]')).toBeVisible();
  expect(
    await page.locator('[data-overview-section="bookings"] a[href^="/transactions/"]').count(),
  ).toBeLessThanOrEqual(5);
  await expect(
    page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Vermögen' }),
  ).toBeVisible();
  expect(
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .evaluate((nav) => nav.scrollWidth <= nav.clientWidth),
  ).toBe(true);
  await capture('overview');
  const profile = page.getByRole('button', { name: 'Accountverwaltung', exact: true });
  await profile.click();
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Benachrichtigungen' })).toBeVisible();
  await capture('profile-dialog');
  await closeDialog();
  await expect(profile).toBeFocused();
  await page.getByRole('button', { name: 'Kontogruppen wählen' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Alle Konten' })).toBeVisible();
  await capture('group-dialog');
  await closeDialog();
  await page.goto('/transactions?from=2026-11-01&to=2026-11-30');
  await expect(page.locator('.finance-booking-day').first()).toBeVisible();
  await capture('transactions');
  await page.getByRole('button', { name: 'Vorheriger Monat' }).click();
  await expect(page).toHaveURL(/from=2026-10-01/);
  await page.goto('/accounts');
  await expect(page.locator('[data-account-card]').first()).toBeVisible();
  await capture('accounts');
  await page.goto('/analytics?from=2026-07-01&to=2026-10-31');
  const category = page.locator('[data-analysis-module="categories"]').getByRole('button');
  await expect(category.locator('.mini-finance-ring')).toBeVisible();
  if (width > 700) {
    const tile = category.locator('..');
    await category.scrollIntoViewIfNeeded();
    const position = () =>
      tile.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height };
      });
    const before = await position();
    await category.hover();
    await expect(tile.locator('.finance-tile__graphic')).toHaveCSS('filter', 'brightness(1.12)');
    expect(await position()).toEqual(before);
    await page.mouse.move(0, 0);
  }
  await capture('analytics');
  const before = page.url();
  await category.click();
  await expect(page.getByRole('dialog', { name: 'Ausgaben nach Kategorien' })).toBeVisible();
  await expect(page).toHaveURL(before);
  await capture('analytics-dialog');
  await closeDialog();
  await expect(category).toBeFocused();
  await page.goto('/contracts');
  await expect(page.getByText('Geplant übrig', { exact: true })).toBeVisible();
  await capture('contracts');
  await page.getByRole('button', { name: 'Vertragskalender' }).click();
  await expect(page.getByRole('dialog', { name: 'Vertragskalender' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nicht monatlich' })).toBeVisible();
  await expect(page.getByText('Vertragskalender wird geladen …')).toHaveCount(0);
  await capture('calendar-dialog');
  await closeDialog();
  await page.goto('/more');
  await expect(page.getByRole('navigation', { name: 'Mein Geld' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Verwalten' })).toBeVisible();
  await capture('more');
  const mode = page.getByRole('button', { name: 'Dunkelmodus', exact: true });
  await mode.click();
  await expect(page.locator('html')).not.toHaveClass(/theme-reveal/);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mode.click();
  await expect(page.locator('html')).toHaveClass(/theme-reveal/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .getAnimations()
          .some(
            (animation) =>
              (animation.effect as KeyframeEffect | null)?.pseudoElement === '::view-transition-new(root)' &&
              animation.effect?.getTiming().duration === 1700,
          ),
      ),
    )
    .toBe(true);
  await expect(page.locator('html')).not.toHaveClass(/theme-reveal/);
});
