import { test, expect } from './fixtures.js';
import { seedDemoState } from '../../apps/web/app/utils/demo-state.js';
import { transitionDemo } from '../../apps/web/app/utils/demo-finance.js';

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

test('demo history caps changed values and confirmed reset preserves real data and device preferences', /** Synthetic fixtures never replace real rows; cancel restores focus and confirmation resets only one namespace. */ async ({
  page,
}, info) => {
  let synthetic = seedDemoState();
  for (let index = 1; index <= 60; index++)
    synthetic = transitionDemo(
      synthetic,
      { kind: 'scenario', basisPoints: index * 10 },
      `demo-history-${index}`,
      '2026-11-01T12:00:00.000Z',
    );
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Finish real authentication before seeding only dedicated synthetic storage. */ (url) => url.pathname === '/',
  );
  await page.evaluate(
    /** Install only owned synthetic fixture data and a harmless unrelated sentinel. */ (state) => {
      localStorage.setItem('haushaltsbuch-demo-v1', JSON.stringify(state));
      localStorage.setItem('demo-reset-unrelated-test', 'keep');
    },
    synthetic,
  );
  const transactions = await (await page.request.get('/api/v1/transactions?limit=100')).json();
  const wealth = await (await page.request.get('/api/v1/wealth-records')).json();
  const preferences = await page.evaluate(
    /** Observe device preferences without writing real amounts. */ () =>
      localStorage.getItem('haushaltsbuch-workspace-v1'),
  );
  await page.goto('/wealth');
  const portfolio = page.getByRole('region', { name: 'Investment-Demo', exact: true });
  const history = portfolio.getByRole('region', { name: 'Aufgezeichneter Demo-Verlauf', exact: true });
  await history.getByText('48 aufgezeichnete Simulationswerte anzeigen', { exact: true }).click();
  await expect(history.locator('[data-demo-history]')).toHaveCount(48);
  await expect(history.locator('[data-demo-history="demo-history-13"]')).toBeVisible();
  const before = await page.evaluate(
    /** Capture only the dedicated demo payload for cancel/replay assertions. */ () =>
      localStorage.getItem('haushaltsbuch-demo-v1'),
  );
  const trigger = portfolio.getByRole('button', { name: 'Demo zurücksetzen', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Demo zurücksetzen', exact: true });
  await expect(dialog).toContainText(
    'Echte Konten, aufgezeichnetes Vermögen, Profil und Geräteeinstellungen bleiben erhalten.',
  );
  await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(
    await page.evaluate(
      /** Cancel cannot replace saved demo assets. */ () => localStorage.getItem('haushaltsbuch-demo-v1'),
    ),
  ).toBe(before);
  await portfolio.getByRole('button', { name: 'Demo-Szenario anwenden', exact: true }).click();
  await expect(history.locator('[data-demo-history]')).toHaveCount(48);
  expect(
    await page.evaluate(
      /** An unchanged valuation keeps the same last recorded identity. */ () =>
        JSON.parse(localStorage.getItem('haushaltsbuch-demo-v1')!).history.at(-1).id,
    ),
  ).toBe('demo-history-60');
  await portfolio.getByLabel('Simulierte Änderung in Basispunkten').fill('700');
  await portfolio.getByRole('button', { name: 'Demo-Szenario anwenden', exact: true }).click();
  await expect(history.locator('[data-demo-history]')).toHaveCount(48);
  await expect(history.locator('[data-demo-history="demo-history-13"]')).toHaveCount(0);
  await trigger.click();
  await dialog.getByRole('button', { name: 'Nur Demo-Daten zurücksetzen', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(portfolio.getByLabel('Simulierte Änderung in Basispunkten')).toHaveValue('0');
  await expect(history.getByText('1 aufgezeichnete Simulationswerte anzeigen', { exact: true })).toBeVisible();
  await expect(portfolio.getByRole('region', { name: 'Simuliertes Gesamtvermögen', exact: true })).toContainText(
    '13.734,50 €',
  );
  const persisted = await page.evaluate(
    /** Only the dedicated namespace resets; unrelated preferences and sentinels survive. */ () => ({
      state: JSON.parse(localStorage.getItem('haushaltsbuch-demo-v1')!),
      preferences: localStorage.getItem('haushaltsbuch-workspace-v1'),
      sentinel: localStorage.getItem('demo-reset-unrelated-test'),
    }),
  );
  expect(persisted.state).toEqual({ ...seedDemoState(), revision: synthetic.revision + 3 });
  expect(persisted.preferences).toBe(preferences);
  expect(persisted.sentinel).toBe('keep');
  expect(await (await page.request.get('/api/v1/transactions?limit=100')).json()).toEqual(transactions);
  const afterWealth = await (await page.request.get('/api/v1/wealth-records')).json();
  expect(afterWealth.items).toEqual(wealth.items);
  expect(afterWealth.preview.components).toEqual(wealth.preview.components);
  await page.reload();
  await expect(history.getByText('1 aufgezeichnete Simulationswerte anzeigen', { exact: true })).toBeVisible();
  await page.screenshot({ path: `.local/concept-demo-reset-${info.project.name}.png`, fullPage: true });
});
