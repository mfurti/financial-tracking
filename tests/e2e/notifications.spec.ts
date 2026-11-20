import { test, expect } from './fixtures.js';
import { choose } from './controls.js';

test('notifications page and replay-safe read state preserve their real import and plan sources', /** Real source fixtures exercise pagination, lost-response retry, reload, actual destinations and disappearing events. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Create owned synthetic source fixtures only after private authentication. */ (url) => url.pathname === '/',
  );
  const session = await (await page.request.get('/api/v1/auth/session')).json();
  const headers = { origin: new URL(page.url()).origin, 'x-csrf-token': session.csrfToken };
  const financial = await (await page.request.get('/api/v1/transactions?limit=100')).json();
  const previewResponse = await page.request.post('/api/v1/imports/csv/preview', {
    headers,
    data: {
      content: `Datum;Betrag;Text\n${Array.from({ length: 21 }, /** Produce genuine invalid source rows without committing a financial booking. */ (_, index) => `31.02.2026;invalid;Notification fixture ${index}`).join('\n')}\n`,
      mapping: { bookingDate: 'Datum', amount: 'Betrag', description: 'Text' },
    },
  });
  expect(previewResponse.status()).toBe(201);
  const preview = await previewResponse.json();
  expect(preview.invalidRows).toBe(21);
  const startDate = await page.evaluate(
    /** Use an actual Berlin calendar day for a controlled upcoming confirmed plan. */ () => {
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
      const date = new Date(`${day}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + 1);
      return date.toISOString().slice(0, 10);
    },
  );
  const created = await page.request.post('/api/v1/contracts', {
    headers,
    data: {
      name: 'Notification fixture planned payment',
      provider: 'Synthetic notification provider',
      kind: 'OTHER',
      startDate,
      amountCents: '12345',
      intervalMonths: 1,
    },
  });
  expect(created.status()).toBe(201);
  const contract = await created.json();
  try {
    const issuesBefore = await (await page.request.get(`/api/v1/imports/${preview.run.id}/issues`)).json();
    const contractBefore = await (await page.request.get(`/api/v1/contracts/${contract.id}`)).json();
    const current = await (await page.request.get('/api/v1/notifications?kind=IMPORT_REVIEW&limit=100')).json();
    const own = current.items.filter(
      /** Target only the actual import run created by this test. */ (item: { href: string }) =>
        item.href === `/imports?run=${preview.run.id}`,
    );
    expect(own).toHaveLength(21);
    const sourceKey = own[0].sourceKey;
    await page.getByRole('link', { name: 'Benachrichtigungen', exact: true }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Benachrichtigungen', exact: true })).toBeVisible();
    const keys: string[] = [];
    await page.route(
      '**/api/v1/notifications/acknowledgement',
      /** Lose only the first response after the real acknowledgement committed; retry must replay the same source identity. */ async (
        route,
      ) => {
        const body = route.request().postDataJSON();
        expect(Object.keys(body)).toEqual(['sourceKey']);
        keys.push(body.sourceKey);
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        if (keys.length === 1) await route.abort('failed');
        else await route.fulfill({ response });
      },
    );
    const row = page.locator(`[data-notification-key="${sourceKey}"]`);
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Als gelesen markieren', exact: true }).click();
    await expect(row.getByRole('alert')).toBeVisible();
    await row.getByRole('button', { name: 'Als gelesen markieren', exact: true }).click();
    await expect(row).toContainText('Gelesen am');
    expect(keys).toEqual([sourceKey, sourceKey]);
    await page.unroute('**/api/v1/notifications/acknowledgement');
    await page.reload();
    await expect(row).toContainText('Gelesen am');
    await expect(page.getByRole('button', { name: 'Weitere Hinweise', exact: true })).toBeVisible();
    let pages = 0;
    while (await page.getByRole('button', { name: 'Weitere Hinweise', exact: true }).count()) {
      if (++pages > 10) throw new Error('Unexpected notification fixture volume');
      await page.getByRole('button', { name: 'Weitere Hinweise', exact: true }).click();
      await expect(page.locator('[data-notification-key]')).toHaveCount(
        Math.min(
          (pages + 1) * 20,
          (await (await page.request.get('/api/v1/notifications?limit=100')).json()).items.length,
        ),
      );
    }
    const rendered = await page
      .locator('[data-notification-key]')
      .evaluateAll(
        /** DOM identity set must not duplicate sources after appending pages. */ (elements) =>
          elements.map(
            /** Read only the source identity attribute. */ (element) => element.getAttribute('data-notification-key'),
          ),
      );
    expect(new Set(rendered).size).toBe(rendered.length);
    for (const item of own) expect(rendered).toContain(item.sourceKey);
    await row.getByRole('link', { name: 'Import öffnen', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/imports\\?run=${preview.run.id}`));
    await expect(page.getByRole('heading', { name: 'Import prüfen', exact: true })).toBeVisible();
    await page.goto('/notifications');
    await choose(page, page.getByRole('combobox', { name: 'Hinweistyp', exact: true }), 'Vertragszahlungen');
    const planned = page.locator('[data-notification-key]').filter({ hasText: 'Notification fixture planned payment' });
    await expect(planned).toContainText('123,45 €');
    await expect(planned).toContainText('Planwert, keine bestätigte Zahlung');
    await planned.getByRole('link', { name: 'Vertrag öffnen', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/contracts/${contract.id}`));
    expect(await (await page.request.get(`/api/v1/imports/${preview.run.id}/issues`)).json()).toEqual(issuesBefore);
    expect(await (await page.request.get(`/api/v1/contracts/${contract.id}`)).json()).toEqual(contractBefore);
    expect(await (await page.request.get('/api/v1/transactions?limit=100')).json()).toEqual(financial);
    await page.goto('/notifications');
    expect(
      await page.evaluate(
        /** Long source names and planned values remain within the viewport. */ () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `.local/concept-notifications-${info.project.name}.png`, fullPage: true });
  } finally {
    expect(
      (await page.request.post(`/api/v1/import-runs/${preview.run.id}/cancel`, { headers, data: {} })).status(),
    ).toBe(201);
    expect(
      (await page.request.delete(`/api/v1/contracts/${contract.id}`, { headers, data: { confirm: true } })).status(),
    ).toBe(200);
  }
  await page.goto('/notifications');
  await page.getByRole('button', { name: 'Hinweise aktualisieren', exact: true }).click();
  const remaining = await (await page.request.get('/api/v1/notifications?limit=100')).json();
  expect(
    remaining.items.some(
      /** Canceled previews and removed contracts cannot leave ghost source events. */ (item: { href: string }) =>
        item.href === `/imports?run=${preview.run.id}` || item.href === `/contracts/${contract.id}`,
    ),
  ).toBe(false);
});
