import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.js';

/** Use only the disposable project's standard owner identity, keeping credentials out of logs. */
async function login(page: Page, password = 'e2e-test-password-only') {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Complete private authentication before navigating settings. */ (url) => url.pathname === '/',
  );
}

test('settings hub separates destinations and persists truthful device notification/privacy choices', /** Device choices affect visibility while server profile/group/read metadata and real finance remain separate. */ async ({
  page,
}, info) => {
  await login(page);
  const before = await (await page.request.get('/api/v1/transactions?limit=100')).json();
  await page.goto('/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen', exact: true })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(0);
  for (const [label, path, title] of [
    ['Mein Profil', '/settings/profile', 'Mein Profil'],
    ['Kontogruppen', '/settings/account-groups', 'Kontogruppen'],
    ['Darstellung', '/settings/appearance', 'Darstellung'],
    ['Passwort', '/settings/password', 'Passwort ändern'],
  ] as const) {
    await page.getByRole('link', { name: new RegExp(`^${label}`) }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Zurück zu Einstellungen', exact: true }).click();
  }
  await page.getByRole('checkbox', { name: 'Importprüfungen anzeigen', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Geplante Vertragszahlungen anzeigen', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Finanzbeträge visuell ausblenden', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-amounts-masked', 'true');
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Finanzbeträge visuell ausblenden', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Importprüfungen anzeigen', exact: true })).not.toBeChecked();
  await page
    .getByRole('link', { name: /^Benachrichtigungen/ })
    .last()
    .click();
  await expect(
    page.getByText('Hinweise dieses Typs sind auf diesem Gerät ausgeblendet.', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-notification-key]')).toHaveCount(0);
  await page.goto('/settings');
  await page.getByRole('checkbox', { name: 'Geplante Vertragszahlungen anzeigen', exact: true }).check();
  await page.goto('/notifications');
  await expect(page.getByText(/Gerätefilter: Nur Vertragszahlungen/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Import prüfen', exact: true })).toHaveCount(0);
  await page.goto('/settings');
  await page.getByRole('checkbox', { name: 'Importprüfungen anzeigen', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Finanzbeträge visuell ausblenden', exact: true }).uncheck();
  await page
    .getByRole('main')
    .getByRole('link', { name: /^Analysen/ })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Analysen', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analysen anpassen', exact: true })).toBeVisible();
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Zugang & Datensicherung', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Benutzer- und App-Informationen', exact: true });
  await expect(dialog).toContainText('Europe/Berlin');
  await dialog.getByRole('button', { name: 'Schließen', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.evaluate(
    /** Capture the settled settings hub from its actual top edge after focus restoration. */ () =>
      window.scrollTo(0, 0),
  );
  expect(await (await page.request.get('/api/v1/transactions?limit=100')).json()).toEqual(before);
  expect(
    await page.evaluate(
      /** Settings tiles and long explanatory scope labels wrap within the viewport. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/concept-settings-hub-${info.project.name}.png`, fullPage: true });
});

test('dedicated password page keeps reauthentication and revokes every existing session', /** Disposable credentials are restored after checking real multi-session revocation. */ async ({
  page,
  browser,
}) => {
  await login(page);
  const origin = new URL(page.url()).origin;
  const other = await browser.newContext({ baseURL: origin });
  const secondLogin = await other.request.post('/api/v1/auth/login', {
    headers: { origin },
    data: { username: 'e2e', password: 'e2e-test-password-only' },
  });
  expect(secondLogin.status()).toBe(201);
  let changed = false;
  try {
    await page.goto('/settings/password');
    await expect(page.getByRole('heading', { level: 1, name: 'Passwort ändern', exact: true })).toBeVisible();
    await page.getByLabel('Aktuelles Passwort', { exact: true }).fill('wrong-test-password');
    await page.getByLabel('Neues Passwort (mindestens 12 Zeichen)', { exact: true }).fill('replacement-test-password');
    await page.getByRole('button', { name: 'Passwort ändern & abmelden', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('Aktuelles Passwort', { exact: true })).toHaveValue('');
    await expect(page.getByLabel('Neues Passwort (mindestens 12 Zeichen)', { exact: true })).toHaveValue('');
    expect((await other.request.get('/api/v1/auth/session')).status()).toBe(200);
    expect((await page.request.get('/api/v1/auth/session')).status()).toBe(200);
    await page.getByLabel('Aktuelles Passwort', { exact: true }).fill('e2e-test-password-only');
    await page.getByLabel('Neues Passwort (mindestens 12 Zeichen)', { exact: true }).fill('replacement-test-password');
    await page.getByRole('button', { name: 'Passwort ändern & abmelden', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    changed = true;
    expect((await other.request.get('/api/v1/auth/session')).status()).toBe(401);
    expect((await page.request.get('/api/v1/auth/session')).status()).toBe(401);
  } finally {
    await other.close();
    if (changed) {
      const restored = await page.request.post('/api/v1/auth/login', {
        headers: { origin },
        data: { username: 'e2e', password: 'replacement-test-password' },
      });
      expect(restored.status()).toBe(201);
      const session = await restored.json();
      const reset = await page.request.post('/api/v1/auth/password', {
        headers: { origin, 'x-csrf-token': session.csrfToken },
        data: { currentPassword: 'replacement-test-password', newPassword: 'e2e-test-password-only' },
      });
      expect(reset.status()).toBe(201);
    }
  }
});

test('revoked sessions still leave private views after password-error handling', /** The narrow reauthentication error exception must never keep an expired or revoked session authenticated. */ async ({
  page,
}) => {
  await login(page);
  await page.goto('/settings');
  const session = await (await page.request.get('/api/v1/auth/session')).json();
  const origin = new URL(page.url()).origin;
  expect(
    (
      await page.request.post('/api/v1/auth/logout', {
        headers: { origin, 'x-csrf-token': session.csrfToken },
        data: {},
      })
    ).status(),
  ).toBe(201);
  await page
    .getByRole('main')
    .getByRole('link', { name: /^Mein Profil/ })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Anmelden', exact: true })).toBeVisible();
});
