import { test, expect } from './fixtures.js';

test('shared concept navigation stays compact and marks existing destinations consistently', /** Preserve real navigation/auth while replacing the desktop sidebar with one responsive navigation surface. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Do not confuse the login heading with a completed session. */ (url) => url.pathname === '/',
  );
  await expect(page.locator('.sidebar')).toHaveCount(0);
  const navigation = page.getByRole('navigation', { name: 'Hauptnavigation', exact: true });
  await expect(navigation).toHaveCount(1);
  await expect(navigation).toHaveCSS('position', 'fixed');
  for (const label of ['Umsätze', 'Konten', 'Analysen', 'Verträge', 'Vermögen', 'Übersicht', 'Mehr']) {
    await navigation.getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(navigation.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await page
    .getByRole('navigation', { name: 'Verwalten', exact: true })
    .getByRole('link', { name: 'Einstellungen', exact: true })
    .click();
  await expect(navigation.getByRole('link', { name: 'Mehr', exact: true })).toHaveAttribute('aria-current', 'page');
  expect(
    await page.evaluate(
      /** Navigation cannot establish document overflow at boundary widths. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/concept-shell-${info.project.name}.png` });
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
