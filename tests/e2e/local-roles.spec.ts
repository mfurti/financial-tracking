import { test, expect } from './fixtures.js';
import { wealthRecordsSchema } from '../../packages/contracts/src/index.js';

/** Exclude only the preview's current query instant; immutable rows, source observations and exact totals remain compared. */
function stableResource(path: string, value: unknown) {
  if (path !== '/wealth-records') return value;
  const parsed = wealthRecordsSchema.parse(value);
  const { asOf, ...preview } = parsed.preview;
  void asOf;
  return { ...parsed, preview };
}

for (const english of [false, true]) {
  test(`local roles edit and reset stay synthetic (${english ? 'en' : 'de'})`, /** The displayed role never participates in API authentication, CSRF or real owner persistence. */ async ({
    page,
    browser,
  }, info) => {
    if (english)
      await page.addInitScript(
        /** Restore the supported device language before the first page. */ () => {
          localStorage.setItem('haushaltsbuch-workspace-v1', JSON.stringify({ version: 1, language: 'en' }));
        },
      );
    await page.goto('/login');
    await page.getByLabel(english ? 'Username' : 'Benutzername', { exact: true }).fill('e2e');
    await page.getByLabel(english ? 'Password' : 'Passwort', { exact: true }).fill('e2e-test-password-only');
    await page.getByRole('button', { name: english ? 'Sign in' : 'Anmelden', exact: true }).click();
    await page.waitForURL(
      /** Complete actual authentication before observing demo-only changes. */ (url) => url.pathname === '/',
    );
    const session = await (await page.request.get('/api/v1/auth/session')).json();
    const endpoints = ['/workspace/profile', '/accounts', '/transactions?limit=100', '/wealth-records'];
    const before = await Promise.all(
      endpoints.map(
        /** Read only disposable owner resources for exact preservation proof. */ async (path) =>
          stableResource(path, await (await page.request.get(`/api/v1${path}`)).json()),
      ),
    );
    const writes: string[] = [];
    page.on(
      'request',
      /** Demo form interactions must never submit a real API mutation. */ (request) => {
        if (request.url().includes('/api/v1/') && request.method() !== 'GET')
          writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
      },
    );
    await page.goto('/settings');
    await page.getByRole('link', { name: english ? /^Local demo roles/ : /^Lokale Demo-Rollen/ }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: english ? 'Local demo roles' : 'Lokale Demo-Rollen', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        english
          ? 'No sign-ins, invitations or real permissions are created.'
          : 'Es entstehen keine Anmeldungen, Einladungen oder echten Berechtigungen.',
        { exact: true },
      ),
    ).toBeVisible();
    await page
      .getByRole('button', { name: english ? 'Edit Demo Eigentümer' : 'Demo Eigentümer bearbeiten', exact: true })
      .click();
    await page.getByLabel(english ? 'Demo display name' : 'Demo-Anzeigename', { exact: true }).fill('   ');
    await page.getByRole('button', { name: english ? 'Save demo role' : 'Demo-Rolle speichern', exact: true }).click();
    await expect(page.getByLabel(english ? 'Demo display name' : 'Demo-Anzeigename', { exact: true })).toBeFocused();
    await page
      .getByLabel(english ? 'Demo display name' : 'Demo-Anzeigename', { exact: true })
      .fill('Synthetic reviewer');
    await page.getByLabel(english ? 'Demo display role' : 'Demo-Anzeigerolle', { exact: true }).selectOption('viewer');
    await page.getByRole('button', { name: english ? 'Save demo role' : 'Demo-Rolle speichern', exact: true }).click();
    await expect(
      page.getByText(
        english
          ? 'Demo role saved. Real access remains unchanged.'
          : 'Demo-Rolle gespeichert. Echter Zugang bleibt unverändert.',
        { exact: true },
      ),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByText('Synthetic reviewer', { exact: true })).toBeVisible();
    expect(await (await page.request.get('/api/v1/auth/session')).json()).toEqual(session);
    await page
      .getByRole('button', { name: english ? 'Add demo entry' : 'Demo-Eintrag hinzufügen', exact: true })
      .click();
    await page
      .getByLabel(english ? 'Demo display name' : 'Demo-Anzeigename', { exact: true })
      .fill('Synthetic second owner');
    await page.getByLabel(english ? 'Demo display role' : 'Demo-Anzeigerolle', { exact: true }).selectOption('owner');
    await page.getByRole('button', { name: english ? 'Save demo role' : 'Demo-Rolle speichern', exact: true }).click();
    await expect(page.getByText('Synthetic second owner', { exact: true })).toBeVisible();
    const raw = await page.evaluate(
      /** Inspect only the dedicated synthetic namespace. */ () => localStorage.getItem('haushaltsbuch-demo-v1'),
    );
    await page.getByRole('button', { name: english ? 'Reset demo' : 'Demo zurücksetzen', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: english ? 'Cancel' : 'Abbrechen', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(
      await page.evaluate(
        /** Cancel cannot rewrite any synthetic role or portfolio state. */ () =>
          localStorage.getItem('haushaltsbuch-demo-v1'),
      ),
    ).toBe(raw);
    await page.getByRole('button', { name: english ? 'Reset demo' : 'Demo zurücksetzen', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: english ? 'Reset demo data only' : 'Nur Demo-Daten zurücksetzen', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Demo Eigentümer', { exact: true })).toBeVisible();
    await expect(page.getByText('Synthetic reviewer', { exact: true })).toHaveCount(0);
    expect(writes).toEqual([]);
    const after = await Promise.all(
      endpoints.map(
        /** Confirm all real owner and financial resources are unchanged. */ async (path) =>
          stableResource(path, await (await page.request.get(`/api/v1${path}`)).json()),
      ),
    );
    expect(after).toEqual(before);
    const origin = new URL(page.url()).origin;
    expect(
      (
        await page.request.patch('/api/v1/workspace/profile', {
          headers: { origin, 'x-csrf-token': 'synthetic-role-is-not-a-token' },
          data: { displayName: 'Must not persist' },
        })
      ).status(),
    ).toBe(403);
    const anonymous = await browser.newContext({ baseURL: origin });
    try {
      expect((await anonymous.request.get('/api/v1/auth/session')).status()).toBe(401);
    } finally {
      await anonymous.close();
    }
    expect(
      await page.evaluate(
        /** Long local-role copy must fit the selected device. */ () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.evaluate(/** Capture the settled roles view after confirmed reset. */ () => window.scrollTo(0, 0));
    await page.screenshot({
      path: `.local/concept-local-roles-${english ? 'en' : 'de'}-${info.project.name}.png`,
      fullPage: true,
    });
  });
}
