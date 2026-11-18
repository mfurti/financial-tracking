import { test, expect } from './fixtures.js';

test('shared financial surfaces use responsive gutters, restrained depth and stable tile geometry', /** Assert computed behavior on a real existing page rather than repeat token declarations. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Wait for completed authentication before inspecting the shell. */ (url) => url.pathname === '/',
  );
  await expect(page.locator('.finance-overview-stats > section[data-state=ready]').first()).toBeVisible();
  const content = page.locator('.page-content');
  await expect(content).toHaveCSS('max-width', '1480px');
  await expect(content).toHaveCSS('padding-left', info.project.use.viewport!.width <= 700 ? '17px' : '32px');
  const tile = page.locator('.finance-overview-stats > section[data-state=ready]').first();
  await expect(tile).toHaveCSS('border-radius', '22px');
  await expect(tile).toHaveCSS('box-shadow', 'none');
  const before = await tile.boundingBox();
  await tile.hover();
  expect(await tile.boundingBox()).toEqual(before);
  await expect(page.locator('.topbar')).toHaveCSS('position', 'sticky');
  await page.screenshot({ path: `.local/concept-surfaces-${info.project.name}.png`, fullPage: true });
});
