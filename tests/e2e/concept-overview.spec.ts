import { test, expect, conceptFixtureLabels } from './fixtures.js';
import {
  accountGroupSchema,
  categoryBudgetSchema,
  categorySchema,
  contractSchema,
  sessionSchema,
} from '../../packages/contracts/src/index.js';

test('overview follows device column composition and retains exact actual-month navigation', /** Inspect rendered section ownership and real scoped totals rather than screenshot shape alone. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Preserve the real authenticated flow before choosing a month. */ (url) => url.pathname === '/',
  );
  await page.goto('/?month=2026-11');
  await expect(page.locator('[data-overview-section="bookings"]')).toBeVisible();
  const width = info.project.use.viewport!.width;
  const expected =
    width > 1100
      ? [['bookings'], ['payments', 'accounts'], ['categories']]
      : width > 700
        ? [
            ['bookings', 'accounts'],
            ['payments', 'categories'],
          ]
        : [['bookings', 'payments', 'accounts', 'categories']];
  const order = await page
    .locator('[data-overview-column]')
    .evaluateAll(
      /** Read the actual DOM order and column grouping, including slot-owned sections. */ (columns) =>
        columns.map(
          /** Each section contributes exactly once to the current composition. */ (column) =>
            [...column.querySelectorAll('[data-overview-section]')].map(
              /** Keep assertions independent of translated headings. */ (section) =>
                section.getAttribute('data-overview-section'),
            ),
        ),
    );
  expect(order).toEqual(expected);
  await expect(page.locator('.overview-net')).toHaveText('2.080,10 €');
  await page.getByRole('button', { name: 'Vorheriger Monat', exact: true }).click();
  await expect(page).toHaveURL(/month=2026-10/);
  await expect(page.locator('.overview-net')).toHaveText('2.901,77 €');
  await page.reload();
  await expect(page.locator('.overview-net')).toHaveText('2.901,77 €');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.finance-overview-columns')).toHaveAttribute('data-layout', 'desktop');
  await expect(page.locator('.overview-net')).toHaveText('2.901,77 €');
  await page.setViewportSize(info.project.use.viewport!);
  await expect(page.locator('.finance-overview-columns')).toHaveAttribute(
    'data-layout',
    width > 1100 ? 'desktop' : width > 700 ? 'tablet' : 'mobile',
  );
  const accountCopyWidth = await page
    .locator('[data-overview-section="accounts"] .account-row > div')
    .first()
    .evaluate(
      /** Large exact balances must not collapse the adjacent long account name into character fragments. */ (
        element,
      ) => element.getBoundingClientRect().width,
    );
  expect(accountCopyWidth).toBeGreaterThanOrEqual(150);
  expect(
    await page.evaluate(
      /** Long synthetic labels and exact large balances cannot expand the document. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/concept-overview-${info.project.name}.png`, fullPage: true });
});

test('planned payment widget separates failure, empty plan and recovered real obligations', /** Scope injected errors to the widget, preserving the real actual-month report. */ async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Wait for a valid session before injecting the plan response. */ (url) => url.pathname === '/',
  );
  await page.route(
    '**/api/v1/contracts',
    /** The failure affects planned obligations, never actual income/expenses. */ (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'TEMPORARY', message: 'Plan nicht verfügbar.' }),
      }),
  );
  await page.goto('/?month=2026-11');
  const payments = page.locator('[data-overview-section="payments"]');
  await expect(payments.getByRole('alert')).toBeVisible();
  await expect(payments.locator('.contract-list-row')).toHaveCount(0);
  await expect(page.locator('.overview-net')).toHaveText('2.080,10 €');
  await page.unroute('**/api/v1/contracts');
  let releaseEmpty!: () => void;
  const emptyResponse = new Promise<void>(
    /** Keep retry pending long enough to prove repeated actions are disabled. */ (resolve) => {
      releaseEmpty = resolve;
    },
  );
  await page.route(
    '**/api/v1/contracts',
    /** Empty confirmed plans are distinct from a failed fetch. */ async (route) => {
      await emptyResponse;
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    },
  );
  await payments.getByRole('button', { name: 'Erneut laden', exact: true }).click();
  try {
    await expect(payments.getByRole('button', { name: 'Erneut laden', exact: true })).toBeDisabled();
  } finally {
    releaseEmpty();
  }
  await expect(payments.getByText('Keine anstehenden Vertragszahlungen.', { exact: true })).toBeVisible();
  await expect(payments.locator('.contract-list-row')).toHaveCount(0);
  await page.unroute('**/api/v1/contracts');
  await page.reload();
  await expect(payments).toContainText(conceptFixtureLabels.contract);
});

test('overview reserves loading tiles, hides stale amounts on failure and recovers to real and empty data', /** Failure injection verifies UI states; the first case separately proves real financial amounts. */ async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-22T11:00:00Z'));
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Complete the real session before injecting one report failure. */ (url) => url.pathname === '/',
  );
  let release!: () => void;
  const pending = new Promise<void>(
    /** Hold one response long enough to inspect meaningful pending state. */ (resolve) => {
      release = resolve;
    },
  );
  await page.route(
    '**/api/v1/analytics/monthly*',
    /** Return an explicit synthetic failure after pending-state assertions. */ async (route) => {
      await pending;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'TEMPORARY', message: 'Bericht vorübergehend nicht verfügbar.' }),
      });
    },
  );
  await page.goto('/?month=2026-11');
  try {
    await expect(page.locator('.finance-overview-stats [data-state="loading"]')).toHaveCount(4);
  } finally {
    release();
  }
  await expect(page.getByRole('button', { name: 'Erneut versuchen', exact: true })).toBeVisible();
  await expect(page.locator('.overview-net')).toHaveCount(0);
  await page.unroute('**/api/v1/analytics/monthly*');
  await page.getByRole('button', { name: 'Erneut versuchen', exact: true }).click();
  await expect(page.locator('.overview-net')).toHaveText('2.080,10 €');
  await page.goto('/?month=2026-09');
  await expect(page.locator('[data-overview-section="bookings"]')).toContainText('noch keine Buchungen');
  await expect(page.locator('[data-overview-section="categories"]')).toContainText('Noch keine Ausgaben');
});

test('month-end forecast opens the calculation and counts linked bookings once', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-22T11:00:00Z'));
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/');
  const session = sessionSchema.parse(await (await page.request.get('/api/v1/auth/session')).json());
  const headers = { origin: new URL(page.url()).origin, 'x-csrf-token': session.csrfToken };
  const contractIds: string[] = [];
  let groupId: string | undefined;
  try {
    for (const plan of [
      { name: 'Erwartete Erstattung', provider: 'Beispiel Verein', day: '2026-11-25', amountCents: '10001' },
      { name: 'Bereits gebuchtes Gehalt', provider: 'Beispiel GmbH', day: '2026-11-01', amountCents: '320000' },
    ]) {
      const response = await page.request.post('/api/v1/contracts', {
        headers,
        data: {
          name: plan.name,
          provider: plan.provider,
          kind: 'OTHER',
          direction: 'INCOME',
          startDate: plan.day,
          endDate: plan.day,
          amountCents: plan.amountCents,
          intervalMonths: 1,
        },
      });
      expect(response.status()).toBe(201);
      contractIds.push(contractSchema.parse(await response.json()).id);
    }

    await page.route('**/api/v1/contracts/calendar?*', (route) => route.abort());
    await page.goto('/?month=2026-11');
    const forecast = page.getByRole('region', { name: 'Bis Monatsende frei', exact: true });
    await expect(forecast.getByRole('alert')).toContainText('Prognose konnte nicht geladen werden.');
    await expect(page.locator('.overview-net')).toHaveText('2.080,10 €');
    await page.unroute('**/api/v1/contracts/calendar?*');
    await forecast.getByRole('button', { name: 'Erneut versuchen', exact: true }).click();

    const trigger = forecast.getByRole('button', { name: /Bis Monatsende frei/ });
    await expect(trigger).toContainText('2.121,11 €');
    await trigger.focus();
    await trigger.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Bis Monatsende frei', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('dl')).toContainText('2.080,10 €');
    await expect(dialog.locator('dl')).toContainText('+100,01 €');
    await expect(dialog.locator('dl')).toContainText('−59,00 €');
    await expect(dialog.locator('dl')).toContainText('2.121,11 €');
    await expect(dialog.getByText('Erwartete Erstattung')).toBeVisible();
    await expect(dialog.getByText(conceptFixtureLabels.contract)).toBeVisible();
    await expect(dialog.getByText('Bereits gebuchtes Gehalt')).toHaveCount(0);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(page).toHaveURL(/\/?month=2026-11$/);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    const group = await page.request.post('/api/v1/account-groups', {
      headers,
      data: { name: 'Leere Prognosegruppe', accountIds: [] },
    });
    expect(group.status()).toBe(201);
    groupId = accountGroupSchema.parse(await group.json()).id;
    await page.goto(`/?month=2026-11&groupId=${groupId}`);
    await expect(trigger).toContainText('0,00 €');
    await trigger.click();
    await expect(dialog.getByText('Keine offenen Fälligkeiten.', { exact: true })).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await page.getByRole('button', { name: 'Vorheriger Monat', exact: true }).click();
    await expect(page).toHaveURL((url) => url.searchParams.get('month') === '2026-10');
    await expect(forecast).toHaveCount(0);
    await page.evaluate(() => {
      localStorage.setItem(
        'haushaltsbuch-workspace-v1',
        JSON.stringify({ version: 1, language: 'en', maskAmounts: true }),
      );
    });
    await page.goto('/?month=2026-11');
    await page.getByRole('button', { name: /Free by month end/ }).click();
    const englishDialog = page.getByRole('dialog', { name: 'Free by month end', exact: true });
    await expect(englishDialog.getByRole('heading', { name: 'Expected income' })).toBeVisible();
    await expect(englishDialog.getByRole('heading', { name: 'Outstanding payments' })).toBeVisible();
    await expect(englishDialog.getByText('Amount hidden', { exact: true })).toHaveCount(6);
    await expect(englishDialog).not.toContainText('€');
  } finally {
    if (groupId) {
      const response = await page.request.delete(`/api/v1/account-groups/${groupId}`, {
        headers,
        data: { confirm: true },
      });
      expect(response.ok()).toBe(true);
    }
    for (const id of contractIds) {
      const response = await page.request.delete(`/api/v1/contracts/${id}`, { headers, data: { confirm: true } });
      expect(response.ok()).toBe(true);
    }
  }
});

test('month-end forecast includes each unspent budget and counts overlapping payments once', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-22T11:00:00Z'));
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/');
  const session = sessionSchema.parse(await (await page.request.get('/api/v1/auth/session')).json());
  const headers = { origin: new URL(page.url()).origin, 'x-csrf-token': session.csrfToken };
  const categories = categorySchema.array().parse(await (await page.request.get('/api/v1/categories')).json());
  const housing = categories.find((category) => category.name === 'Wohnen')!;
  const food = categories.find((category) => category.name === 'Lebensmittel Konzept')!;
  const cleanup: string[] = [];
  try {
    const contract = await page.request.post('/api/v1/contracts', {
      headers,
      data: {
        name: 'Zusätzliche Wohnkosten',
        provider: 'Beispielhaus',
        kind: 'OTHER',
        categoryId: housing.id,
        startDate: '2026-11-28',
        endDate: '2026-11-28',
        amountCents: '10000',
        intervalMonths: 1,
      },
    });
    expect(contract.status()).toBe(201);
    cleanup.push('/api/v1/contracts/' + contractSchema.parse(await contract.json()).id);
    for (const [categoryId, limitCents] of [
      [housing.id, '150000'],
      [food.id, '10000'],
    ]) {
      const response = await page.request.put('/api/v1/budgets', {
        headers,
        data: { month: '2026-11', categoryId, limitCents },
      });
      expect(response.status()).toBe(200);
      cleanup.push('/api/v1/budgets/' + categoryBudgetSchema.parse(await response.json()).id);
    }

    await page.route('**/api/v1/budgets?*', (route) => route.abort());
    await page.goto('/?month=2026-11');
    const forecast = page.getByRole('region', { name: 'Bis Monatsende frei', exact: true });
    await expect(forecast.getByRole('alert')).toContainText('Prognose konnte nicht geladen werden.');
    await expect(page.locator('.overview-net')).toHaveText('2.080,10 €');
    await page.unroute('**/api/v1/budgets?*');
    await forecast.getByRole('button', { name: 'Erneut versuchen', exact: true }).click();
    const trigger = forecast.getByRole('button', { name: /Bis Monatsende frei/ });
    await expect(trigger).toContainText('1.476,10 €');
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Bis Monatsende frei', exact: true });
    await expect(dialog.locator('dl')).toContainText('−445,00 €');
    const housingReserve = dialog.getByRole('listitem').filter({ hasText: 'Wohnen' });
    await expect(housingReserve).toContainText('450,00 €');
    await expect(housingReserve).toContainText('Davon 100,00 € bereits in offenen Zahlungen');
    await expect(dialog.getByRole('listitem').filter({ hasText: 'Lebensmittel Konzept' })).toContainText('95,00 €');
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    const budgets = page.getByRole('region', { name: 'Kategorie-Budgets', exact: true });
    await budgets.getByRole('region', { name: 'Wohnen', exact: true }).getByRole('button').click();
    await page.getByRole('dialog', { name: 'Wohnen', exact: true }).getByRole('button', { name: 'Bearbeiten' }).click();
    const editor = page.getByRole('dialog', { name: 'Budget bearbeiten', exact: true });
    await editor.getByRole('textbox', { name: 'Monatslimit in Euro' }).fill('1100');
    await editor.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(editor).toBeHidden();
    await expect(trigger).toContainText('1.826,10 €');
    await trigger.click();
    await expect(housingReserve).toContainText('Davon 50,00 € bereits in offenen Zahlungen');
    await expect(dialog.locator('dl')).toContainText('−95,00 €');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    const group = await page.request.post('/api/v1/account-groups', {
      headers,
      data: { name: 'Budget-Prognose Testgruppe', accountIds: [] },
    });
    expect(group.status()).toBe(201);
    const groupId = accountGroupSchema.parse(await group.json()).id;
    cleanup.push('/api/v1/account-groups/' + groupId);
    await page.goto(`/?month=2026-11&groupId=${groupId}`);
    await expect(trigger).toContainText('0,00 €');
    await trigger.click();
    await expect(dialog.getByText('Kategorie-Budgets fließen in die Prognose für „Alle Konten“ ein.')).toBeVisible();
    await expect(housingReserve).toHaveCount(0);
  } finally {
    for (const url of cleanup) {
      const response = await page.request.delete(url, { headers, data: { confirm: true } });
      expect(response.ok()).toBe(true);
    }
  }
});
