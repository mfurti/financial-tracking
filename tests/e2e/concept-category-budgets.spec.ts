import { test, expect } from './fixtures.js';
import { choose } from './controls.js';

test('sets a monthly limit and opens the relevant expense bookings in a popup', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-22T11:00:00Z'));
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/' && url.searchParams.get('month') === '2026-11');

  const section = page.getByRole('region', { name: 'Kategorie-Budgets', exact: true });
  await section.getByRole('button', { name: 'Budget anlegen', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Budget anlegen', exact: true });
  await choose(page, create.getByRole('button', { name: 'Kategorie', exact: true }), 'Wohnen');
  const amount = page.getByRole('textbox', { name: 'Monatslimit in Euro' });
  await amount.fill('0');
  await create.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(create.getByText('Gib ein gültiges Budget über 0 € ein.')).toBeVisible();
  await amount.fill('1500,00');
  await create.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(create).toBeHidden();

  const tile = section.getByRole('region', { name: 'Wohnen', exact: true });
  const trigger = tile.getByRole('button', { name: /Wohnen/ });
  await expect(tile).toContainText('1.050,00 € von 1.500,00 €');
  await expect(tile).toContainText('450,00 € übrig');
  await expect(tile.getByRole('progressbar')).toHaveAttribute('value', '70');
  await trigger.focus();
  await trigger.press('Enter');
  const details = page.getByRole('dialog', { name: 'Wohnen', exact: true });
  await expect(details.getByText('Miete November', { exact: true })).toBeVisible();
  await expect(details.getByText('−1.050,00 €', { exact: true })).toBeVisible();
  await expect(details.getByText('Beispiel GmbH', { exact: true })).toHaveCount(0);
  expect(await details.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page).toHaveURL(/month=2026-11$/);
  await page.keyboard.press('Escape');
  await expect(details).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await details.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Budget bearbeiten', exact: true });
  await expect(amount).toHaveValue('1500,00');
  await amount.fill('1000,00');
  await edit.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(tile).toContainText('50,00 € über Budget');
  await expect(tile.getByRole('progressbar')).toHaveAttribute('value', '100');
  await page.reload();
  await expect(tile).toContainText('50,00 € über Budget');

  await page.getByRole('button', { name: 'Vorheriger Monat', exact: true }).click();
  await expect(section.getByText('Für diesen Monat gibt es noch keine Budgets.')).toBeVisible();
  await page.getByRole('button', { name: 'Nächster Monat', exact: true }).click();
  await trigger.click();
  await details.getByRole('button', { name: 'Budget löschen', exact: true }).click();
  await details.getByRole('button', { name: 'Löschen', exact: true }).click();
  await expect(section.getByText('Für diesen Monat gibt es noch keine Budgets.')).toBeVisible();
  await expect(page.locator('.overview-net')).toHaveText('2.080,10 €');
});
