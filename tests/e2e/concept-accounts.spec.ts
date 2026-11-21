import { test, expect, conceptFixtureLabels } from './fixtures.js';

test('compact account cards preserve exact observed, negative and missing balances', /** Open real account destinations without treating missing sources as zero. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Await authentication before reading real isolated accounts. */ (url) => url.pathname === '/',
  );
  await page.goto('/accounts');
  const cards = page.locator('[data-account-card]');
  await expect(cards).toHaveCount(5);
  await expect(cards.filter({ hasText: conceptFixtureLabels.checking })).toContainText('9.007.199.254.740.993,01 €');
  await expect(cards.filter({ hasText: conceptFixtureLabels.liability })).toContainText('−450,00 €');
  const missing = cards.filter({ hasText: conceptFixtureLabels.missing });
  await expect(missing).toContainText('Kein Saldo');
  await expect(missing).not.toContainText('0,00 €');
  expect(
    await page.evaluate(
      /** Large exact balances must wrap within their account cards, never widen the document. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/concept-accounts-${info.project.name}.png`, fullPage: true });
  await missing.getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(conceptFixtureLabels.missing);
  await expect(page.getByRole('region', { name: 'Beobachteter gebuchter Saldo', exact: true })).toContainText(
    'CSV-Umsätze ersetzen keinen Kontostand',
  );
  await expect(page.getByRole('link', { name: 'Alle Konten', exact: true })).toBeVisible();
  await page.screenshot({ path: `.local/concept-account-detail-${info.project.name}.png`, fullPage: true });
  expect(
    await page.evaluate(
      /** Account detail never expands the document for long labels. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test('dedicated account creation and editing preserve drafts until confirmed saves', /** Client/server failures must not fabricate success or an opening balance. */ async ({
  page,
}, info) => {
  const browserErrors: string[] = [];
  let posted = 0;
  page.on(
    'pageerror',
    /** Keep browser failures separate from an intentionally rejected API save. */ (cause) =>
      browserErrors.push(cause.message),
  );
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Complete real login before mutating only synthetic test-owned accounts. */ (url) => url.pathname === '/',
  );
  await page.goto('/accounts');
  await page.getByRole('link', { name: 'Konto hinzufügen', exact: true }).click();
  await expect(page).toHaveURL(/\/accounts\/add$/);
  await page.getByRole('button', { name: 'Konto anlegen', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toBeFocused();
  const name = `Neues Konzeptkonto ${info.project.name}`;
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.route(
    '**/api/v1/accounts',
    /** Reject only the first explicit create, preserving the real read path. */ async (route) =>
      route.request().method() === 'POST'
        ? (posted++,
          route.fulfill({
            status: 503,
            json: { error: { code: 'INTERNAL_ERROR', message: 'synthetic', requestId: 'synthetic' } },
          }))
        : route.continue(),
  );
  await page.getByRole('button', { name: 'Konto anlegen', exact: true }).click();
  try {
    await expect(page.getByRole('alert')).toBeVisible();
  } finally {
    const invalidFields = await page.locator('form').evaluate(
      /** Inspect native constraint state without recording field values. */ (form) =>
        [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select')].map(
          /** Record only validation metadata for the failed synthetic submit. */ (field) => ({
            name: field.name,
            valid: field.validity.valid,
            disabled: field.disabled,
            message: field.validationMessage,
          }),
        ),
    );
    await info.attach('account-submit-diagnostics.json', {
      body: JSON.stringify({ browserErrors, posted, invalidFields }),
      contentType: 'application/json',
    });
  }
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue(name);
  expect(posted).toBe(1);
  await page.unroute('**/api/v1/accounts');
  await page.getByRole('button', { name: 'Konto anlegen', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await expect(page.getByText(/Kein beobachteter Saldo/)).toBeVisible();
  await page.route(
    '**/api/v1/accounts/*',
    /** Fail one annotation save while retaining the user's draft. */ async (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 503,
            json: { error: { code: 'INTERNAL_ERROR', message: 'synthetic', requestId: 'synthetic' } },
          })
        : route.continue(),
  );
  await page.getByLabel('Kontoname', { exact: true }).fill(`${name} geändert`);
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Kontoname', { exact: true })).toHaveValue(`${name} geändert`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  await page.unroute('**/api/v1/accounts/*');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${name} geändert`);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${name} geändert`);
  expect(browserErrors).toEqual([]);
});
