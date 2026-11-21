import { test, expect } from './fixtures.js';

test.use({ locale: 'de-DE', timezoneId: 'Europe/Berlin', colorScheme: 'light', reducedMotion: 'reduce' });
test.beforeEach(
  /** Keep visual evidence comparable to the captured source reference. */ async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-18T12:00:00Z') });
  },
);

test('analysis modules retain selected order, cancellation and chart preference after reload', /** Configure delivered modules only, preserving future IDs without fabricated financial values. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(/** Complete login before device-local module editing. */ (url) => url.pathname === '/');
  await page.goto('/analytics?from=2026-07-01&to=2026-10-31');
  const modules = page.locator('[data-analysis-module]');
  await expect(modules).toHaveCount(6);
  expect(
    await modules.evaluateAll(
      /** Inspect actual visible order rather than stored data alone. */ (elements) =>
        elements.map(
          /** Preserve stable identities across translations. */ (element) =>
            element.getAttribute('data-analysis-module'),
        ),
    ),
  ).toEqual(['months', 'categories', 'merchants', 'history', 'reserve', 'contracts']);
  const trigger = page.getByRole('button', { name: 'Analysen anpassen', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Deine Analysen anpassen', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(6);
  await expect(dialog.getByRole('checkbox', { name: 'Aufgezeichnetes Vermögen', exact: true })).toBeEnabled();
  await dialog.getByRole('checkbox', { name: 'Kategorien', exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(modules).toHaveCount(6);
  await trigger.click();
  await expect(dialog.getByRole('checkbox', { name: 'Kategorien', exact: true })).toBeChecked();
  await dialog.getByRole('checkbox', { name: 'Kategorien', exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Händler nach oben', exact: true }).click();
  await dialog.getByRole('button', { name: 'Auswahl speichern', exact: true }).click();
  expect(
    await modules.evaluateAll(
      /** Apply committed device selection and order immediately. */ (elements) =>
        elements.map(
          /** Read visible identities in DOM order. */ (element) => element.getAttribute('data-analysis-module'),
        ),
    ),
  ).toEqual(['merchants', 'months', 'history', 'reserve', 'contracts']);
  await page.getByRole('button', { name: 'Ringdiagramme', exact: true }).click();
  await page.reload();
  await expect(modules).toHaveCount(5);
  await expect(modules.first()).toHaveAttribute('data-analysis-module', 'merchants');
  await expect(page.getByRole('button', { name: 'Ringdiagramme', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const beforeDetail = page.url();
  const merchantTile = modules.first().getByRole('button');
  await merchantTile.click();
  await expect(page.getByRole('dialog', { name: 'Wo gibst du dein Geld aus?', exact: true })).toBeVisible();
  await expect(page).toHaveURL(beforeDetail);
  expect(new URL(page.url()).searchParams.has('accountId')).toBe(false);
  expect(new URL(page.url()).searchParams.has('categoryId')).toBe(false);
  await page.keyboard.press('Escape');
  await expect(merchantTile).toBeFocused();
  await page.evaluate(
    /** Capture sticky navigation at its real top position after separately proving section navigation. */ () =>
      window.scrollTo(0, 0),
  );
  await page.screenshot({ path: `.local/analysis-modules-${info.project.name}.png`, fullPage: true });
  expect(
    await page.evaluate(
      /** Long module labels cannot create page-level overflow. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await trigger.click();
  await dialog.getByRole('checkbox', { name: 'Händler', exact: true }).uncheck();
  await dialog.getByRole('checkbox', { name: 'Monatsvergleich', exact: true }).uncheck();
  for (const label of ['Aufgezeichnetes Vermögen', 'Notgroschen', 'Vertragskosten'])
    await dialog.getByRole('checkbox', { name: label, exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Auswahl speichern', exact: true }).click();
  await expect(modules).toHaveCount(0);
  await expect(page.getByText(/Keine Analysen ausgewählt/)).toBeVisible();
  await trigger.click();
  await dialog.getByRole('checkbox', { name: 'Kategorien', exact: true }).check();
  await dialog.getByRole('button', { name: 'Auswahl speichern', exact: true }).click();
  await expect(modules).toHaveCount(1);
  const savedModules = await page.evaluate(
    /** Inspect only the allowlisted nonfinancial preference key to distinguish writing from restore failures. */ () =>
      JSON.parse(localStorage.getItem('haushaltsbuch-workspace-v1') ?? '{}').analysisModules,
  );
  expect(savedModules).toContain('categories');
  await page.reload();
  await expect(modules).toHaveCount(1);
  await expect(modules.first()).toHaveAttribute('data-analysis-module', 'categories');
});
