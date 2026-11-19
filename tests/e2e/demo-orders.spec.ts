import { test, expect } from './fixtures.js';

test('demo orders validate whole shares, cash and holdings with keyboard and reload', /** Synthetic trading never changes real observed values or makes a bank request. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Await private workspace before opening the independent device demo. */ (url) => url.pathname === '/',
  );
  const before = await (await page.request.get('/api/v1/transactions?limit=100')).json();
  const mutations: string[] = [];
  page.on(
    'request',
    /** Observe real writes after authentication without recording secrets or payloads. */ (request) => {
      if (request.url().includes('/api/v1/') && !['GET', 'HEAD'].includes(request.method()))
        mutations.push(request.url());
    },
  );
  await page.goto('/wealth');
  const portfolio = page.getByRole('region', { name: 'Investment-Demo', exact: true });
  await expect(portfolio).toContainText('13.734,50 €');
  await expect(portfolio).toContainText('Keine Bankverbindung, keine Live-Kurse');
  const trigger = portfolio.getByRole('button', { name: 'Kauf / Verkauf simulieren', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Demo-Auftrag', exact: true });
  await expect(dialog).toContainText('Kein echter Auftrag');
  await dialog.getByLabel('Ganze Anteile', { exact: true }).fill('0');
  await dialog.getByRole('button', { name: 'Kauf simulieren', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('1 bis 1000 ganze Anteile eingeben.');
  await expect(dialog.getByLabel('Ganze Anteile', { exact: true })).toBeFocused();
  await dialog.getByLabel('Ganze Anteile', { exact: true }).fill('1000');
  await dialog.getByRole('button', { name: 'Kauf simulieren', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Nicht genug Demo-Guthaben.');
  await expect(dialog.getByLabel('Ganze Anteile', { exact: true })).toHaveValue('1000');
  await dialog.getByLabel('Ganze Anteile', { exact: true }).fill('2');
  await dialog.getByLabel('Ganze Anteile', { exact: true }).press('Enter');
  await expect(dialog).toBeHidden();
  await expect(portfolio).toContainText('12 ganze Anteile');
  await expect(portfolio).toContainText('9.753,10 €');
  await expect(portfolio).toContainText('13.734,50 €');
  await trigger.click();
  await dialog.getByRole('combobox', { name: 'Demo-Aktion', exact: true }).selectOption('sell');
  await dialog.getByLabel('Ganze Anteile', { exact: true }).fill('13');
  await dialog.getByRole('button', { name: 'Verkauf simulieren', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Nicht genug Demo-Anteile.');
  await dialog.getByLabel('Ganze Anteile', { exact: true }).fill('12');
  await dialog.getByRole('button', { name: 'Verkauf simulieren', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(portfolio).toContainText('11.234,50 €');
  await portfolio.getByRole('link', { name: /Demo Weltfonds/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Demo Weltfonds', exact: true })).toBeVisible();
  await expect(page.getByText('Noch keine Demo-Anteile.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kauf / Verkauf simulieren', exact: true }).click();
  await dialog.getByRole('button', { name: 'Kauf simulieren', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('1 ganze Anteile', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('1 ganze Anteile', { exact: true })).toBeVisible();
  expect(await (await page.request.get('/api/v1/transactions?limit=100')).json()).toEqual(before);
  expect(mutations).toEqual([]);
  expect(
    await page.evaluate(
      /** Long labels and exact values cannot widen the detail page. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/concept-demo-security-${info.project.name}.png`, fullPage: true });
});

test('demo scenario is an exact isolated valuation and unknown securities cannot be traded', /** Saved integer basis points affect only explicitly synthetic prices and positions. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(/** Finish authentication before isolated valuation actions. */ (url) => url.pathname === '/');
  await page.goto('/wealth');
  const portfolio = page.getByRole('region', { name: 'Investment-Demo', exact: true });
  await portfolio.getByLabel('Simulierte Änderung in Basispunkten').fill('3000');
  await portfolio.getByRole('button', { name: 'Demo-Szenario anwenden', exact: true }).click();
  await expect(portfolio.getByRole('status')).toContainText('Demo-Szenario gespeichert');
  await expect(portfolio).toContainText('14.104,90 €');
  await expect(portfolio).toContainText('160,49 €');
  await page.reload();
  await expect(portfolio.getByLabel('Simulierte Änderung in Basispunkten')).toHaveValue('3000');
  await expect(portfolio).toContainText('14.104,90 €');
  expect(
    await page.evaluate(
      /** Verify settled phone/tablet/desktop content wraps within its viewport. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/concept-demo-portfolio-${info.project.name}.png`, fullPage: true });
  await page.goto('/wealth/demo/securities/real-account');
  await expect(page.getByRole('heading', { level: 1, name: 'Unbekanntes Demo-Wertpapier' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kauf / Verkauf simulieren' })).toHaveCount(0);
});
