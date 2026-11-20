import type { Page } from '@playwright/test';
import { test, expect } from './fixtures.js';
import { choose } from './controls.js';
import {
  accountSchema,
  workspaceProfileSchema,
  accountGroupSchema,
  contractSchema,
} from '../../packages/contracts/src/index.js';

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

test('workspace settings compose across durable metadata, device choices and stale sources', /** One real journey preserves historical inactive-account scope while local appearance/language/privacy and synthetic roles remain independently scoped. */ async ({
  page,
}, info) => {
  await login(page);
  const session = await (await page.request.get('/api/v1/auth/session')).json();
  const headers = { origin: new URL(page.url()).origin, 'x-csrf-token': session.csrfToken };
  const financial = await (await page.request.get('/api/v1/transactions?limit=100')).json();
  const profile = workspaceProfileSchema.parse(await (await page.request.get('/api/v1/workspace/profile')).json());
  const accounts = accountSchema.array().parse(await (await page.request.get('/api/v1/accounts')).json());
  const checking = accounts.find(
    /** Resolve a real historical fixture rather than inventing a bank/account reference. */ (account) =>
      account.name.startsWith('Gemeinsames Alltagskonto'),
  )!;
  const created = await page.request.post('/api/v1/account-groups', {
    headers,
    data: { name: `Integrated workspace ${info.project.name}`, accountIds: [checking.id] },
  });
  expect(created.status()).toBe(201);
  const group = accountGroupSchema.parse(await created.json());
  let groupDeleted = false;
  let contractId: string | null = null;
  try {
    await page.goto('/settings/profile');
    await page.getByLabel('Anzeigename', { exact: true }).fill('Integrated metadata owner');
    await page.getByRole('button', { name: 'Profil speichern', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Profil gespeichert.');
    expect(
      (await page.request.patch(`/api/v1/accounts/${checking.id}`, { headers, data: { isActive: false } })).status(),
    ).toBe(200);
    await page.goto('/settings/account-groups');
    await expect(page.locator(`[data-account-group="${group.id}"]`)).toContainText('(inaktiv)');
    await page.goto(`/analytics/details?from=2026-10-01&to=2026-10-31&groupId=${group.id}`);
    await expect(page.locator('[data-analysis-total]')).toHaveText('99,99 €');
    await page.goto('/settings/appearance/custom');
    await page.getByRole('button', { name: 'Eigene Farben übernehmen', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'custom');
    await page.goto('/settings');
    await page.getByRole('checkbox', { name: 'Finanzbeträge visuell ausblenden', exact: true }).check();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-amounts-masked', 'true');
    await expect(page.locator('#haushaltsbuch-custom-palette')).toHaveCount(1);
    await page.goto('/analytics');
    await page.getByRole('button', { name: 'Analysen anpassen', exact: true }).click();
    await page.getByRole('dialog').getByRole('checkbox', { name: 'Händler', exact: true }).uncheck();
    await page.getByRole('dialog').getByRole('button', { name: 'Auswahl speichern', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto('/settings');
    await choose(page, page.getByRole('button', { name: 'Sprache', exact: true }), 'English');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await page.goto('/settings/profile');
    await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('Integrated metadata owner');
    await page.goto('/settings/users');
    await expect(page.getByRole('heading', { name: 'Local demo roles', exact: true })).toBeVisible();
    expect(await (await page.request.get('/api/v1/auth/session')).json()).toEqual(session);
    const due = await page.evaluate(
      /** Create an upcoming date using Berlin calendar identity, not the browser's timezone. */ () => {
        const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
        const date = new Date(`${day}T12:00:00Z`);
        date.setUTCDate(date.getUTCDate() + 1);
        return date.toISOString().slice(0, 10);
      },
    );
    const response = await page.request.post('/api/v1/contracts', {
      headers,
      data: {
        name: 'Integrated stale source',
        provider: 'Synthetic settings source',
        kind: 'OTHER',
        startDate: due,
        amountCents: '12345',
        intervalMonths: 1,
      },
    });
    expect(response.status()).toBe(201);
    contractId = contractSchema.parse(await response.json()).id;
    await page.goto('/notifications');
    const row = page.locator('[data-notification-key]').filter({ hasText: 'Integrated stale source' });
    await expect(row).toBeVisible();
    expect(
      (await page.request.delete(`/api/v1/contracts/${contractId}`, { headers, data: { confirm: true } })).status(),
    ).toBe(200);
    contractId = null;
    await row.getByRole('button', { name: 'Mark as read', exact: true }).click();
    await expect(row.getByRole('alert')).toContainText('no longer current');
    await row.getByRole('link', { name: 'Open contract', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Contract not found.');
    await page.goto('/notifications');
    await expect(page.locator('[data-notification-key]').filter({ hasText: 'Integrated stale source' })).toHaveCount(0);
    expect(
      (await page.request.delete(`/api/v1/account-groups/${group.id}`, { headers, data: { confirm: true } })).status(),
    ).toBe(200);
    groupDeleted = true;
    await page.goto(`/analytics/details?from=2026-10-01&to=2026-10-31&groupId=${group.id}`);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('[data-analysis-total]')).toHaveCount(0);
    const choices = await page.evaluate(
      /** Inspect only allowlisted device display choices. */ () =>
        JSON.parse(localStorage.getItem('haushaltsbuch-workspace-v1')!),
    );
    expect(choices).toMatchObject({ language: 'en', maskAmounts: true });
    expect(choices.analysisModules).not.toContain('merchants');
    expect(choices.custom).not.toBeNull();
    expect(await (await page.request.get('/api/v1/transactions?limit=100')).json()).toEqual(financial);
  } finally {
    if (contractId)
      expect(
        (await page.request.delete(`/api/v1/contracts/${contractId}`, { headers, data: { confirm: true } })).status(),
      ).toBe(200);
    if (!groupDeleted)
      expect(
        (
          await page.request.delete(`/api/v1/account-groups/${group.id}`, { headers, data: { confirm: true } })
        ).status(),
      ).toBe(200);
    expect(
      (
        await page.request.patch(`/api/v1/accounts/${checking.id}`, { headers, data: { isActive: checking.isActive } })
      ).status(),
    ).toBe(200);
    expect(
      (
        await page.request.patch('/api/v1/workspace/profile', {
          headers,
          data: { displayName: profile.displayName, contactEmail: profile.contactEmail },
        })
      ).status(),
    ).toBe(200);
  }
});
