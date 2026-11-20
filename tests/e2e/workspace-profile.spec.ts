import { test, expect } from './fixtures.js';

test('owner profile has its own route and preserves failed-save drafts and login identity', /** Editable display/contact metadata reloads durably without changing real financial records. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Complete the existing private session before editing display metadata. */ (url) => url.pathname === '/',
  );
  const before = await (await page.request.get('/api/v1/transactions?limit=100')).json();
  await page.goto('/settings');
  await page.getByRole('link', { name: 'Mein Profil bearbeiten', exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Mein Profil', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Passwort ändern', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Anzeigename', { exact: true })).toHaveValue('e2e');
  await expect(page.getByLabel('Kontakt-E-Mail (optional)', { exact: true })).toHaveValue('');
  await page.getByLabel('Anzeigename', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Profil speichern', exact: true }).click();
  await expect(page.getByLabel('Anzeigename', { exact: true })).toBeFocused();
  await page
    .getByLabel('Anzeigename', { exact: true })
    .fill('Unser gemeinsamer Haushalt mit ausführlichem Anzeigenamen');
  await page.getByLabel('Kontakt-E-Mail (optional)', { exact: true }).fill('contact@example.test');
  await page.route(
    '**/api/v1/workspace/profile',
    /** Fail only writes; real reads and later retry remain genuine. */ async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'UNAVAILABLE', message: 'Temporary profile failure' }),
      });
    },
  );
  await page.getByRole('button', { name: 'Profil speichern', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Anzeigename', { exact: true })).toHaveValue(
    'Unser gemeinsamer Haushalt mit ausführlichem Anzeigenamen',
  );
  await expect(page.getByLabel('Kontakt-E-Mail (optional)', { exact: true })).toHaveValue('contact@example.test');
  await page.unroute('**/api/v1/workspace/profile');
  await page.getByRole('button', { name: 'Profil speichern', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Profil gespeichert.');
  await page.reload();
  await expect(page.getByLabel('Anzeigename', { exact: true })).toHaveValue(
    'Unser gemeinsamer Haushalt mit ausführlichem Anzeigenamen',
  );
  await expect(page.getByLabel('Kontakt-E-Mail (optional)', { exact: true })).toHaveValue('contact@example.test');
  await expect(page.getByText('Anmeldename: e2e', { exact: true })).toBeVisible();
  await page.getByLabel('Kontakt-E-Mail (optional)', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Profil speichern', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Profil gespeichert.');
  await page.reload();
  await expect(page.getByLabel('Kontakt-E-Mail (optional)', { exact: true })).toHaveValue('');
  expect((await (await page.request.get('/api/v1/auth/session')).json()).username).toBe('e2e');
  expect(await (await page.request.get('/api/v1/transactions?limit=100')).json()).toEqual(before);
  expect(
    await page.evaluate(
      /** Long profile copy and fields must wrap on phone/tablet/desktop. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/concept-workspace-profile-${info.project.name}.png`, fullPage: true });
});
