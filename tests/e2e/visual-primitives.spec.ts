import { test, expect } from './fixtures.js';

test('account tile stays stationary and information dialog traps and returns keyboard focus', /** Exercise the reusable primitives through real settings rather than a production-only showcase route. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Complete authentication before navigating to the actual settings feature. */ (url) => url.pathname === '/',
  );
  await page.goto('/settings');
  const tile = page.locator('.finance-tile--account');
  await expect(tile).toContainText('e2e');
  await tile.scrollIntoViewIfNeeded();
  const before = await tile.boundingBox();
  await tile.hover();
  expect(await tile.boundingBox()).toEqual(before);
  const trigger = page.getByRole('button', { name: 'Zugang & Datensicherung', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Benutzer- und App-Informationen', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Europe/Berlin');
  await expect(page.locator('[data-slot="overlay"]')).toHaveCSS('background-color', 'rgba(14, 20, 36, 0.72)');
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(info.project.use.viewport!.height);
  await page.screenshot({ path: `.local/visual-primitives-${info.project.name}.png` });
  await page.keyboard.press('Tab');
  expect(
    await dialog.evaluate(
      /** Focus must stay inside the active dialog. */ (element) =>
        element.contains(element.ownerDocument.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});
