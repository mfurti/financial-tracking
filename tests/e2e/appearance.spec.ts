import { test, expect } from '@playwright/test';
import { appearanceThemes } from '../../apps/web/app/utils/appearance.js';

/** Convert the catalog's opaque sRGB swatches to the browser's computed-color form. */
function rgb(hex: string) {
  return `rgb(${[1, 3, 5].map(/** Parse fixed byte pairs, never monetary values. */ (offset) => parseInt(hex.slice(offset, offset + 2), 16)).join(', ')})`;
}

test('settings palettes apply in both modes and persist across reload and logout', /** Exercise the actual early-restored catalog and native settings controls. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Finanzieller Überblick' })).toBeVisible();
  await page.goto('/settings');
  const select = page.getByLabel('Farbthema', { exact: true });
  await expect(select.locator('option')).toHaveCount(18);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of appearanceThemes) {
    await select.selectOption(theme.id);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.id);
    for (const mode of ['light', 'dark'] as const) {
      await page.getByLabel('Helligkeit', { exact: true }).selectOption(mode);
      await expect(page.locator('body')).toHaveCSS('background-color', rgb(theme[mode][0]));
      await expect(page.getByRole('heading', { name: 'Farben & Darstellung' })).toBeVisible();
    }
  }
  await select.selectOption('dracula');
  await page.reload();
  await expect(select).toHaveValue('dracula');
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    rgb(appearanceThemes.find(/** Match the actual catalog entry. */ (theme) => theme.id === 'dracula')!.dark[0]),
  );
  await page.screenshot({ path: `.local/settings-dracula-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await expect(page).toHaveURL(/login$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');
  await expect(page.getByRole('button', { name: 'Dunkelmodus', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Dunkelmodus', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');
  await expect(page.getByRole('button', { name: 'Dunkelmodus', exact: true })).toHaveAttribute('aria-pressed', 'false');
});
