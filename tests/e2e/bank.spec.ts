import { test, expect } from '@playwright/test';
import type { ImportRun } from '../../packages/contracts/src/index.js';

test('manual bank setup, method/media/TAN/app approval, pending, failures and cancellation', /** Test browser authorization states with explicit synthetic bank responses; ordinary authentication stays real. */ async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Finanzieller Überblick' })).toBeVisible();
  await page.goto('/connections');
  await expect(page.getByText('Bankanbindung vorbereiten', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Bank-PIN', { exact: true })).toBeDisabled();

  const connectionId = '20000000-0000-4000-8000-000000000001',
    runId = '20000000-0000-4000-8000-000000000002';
  const base: ImportRun = {
    id: runId,
    source: 'FINTS',
    status: 'WAITING_FOR_AUTH',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    importedCount: 0,
    knownCount: 0,
    reviewRequiredCount: 0,
    errorCode: null,
    challenge: null,
  };
  let current: ImportRun = {
    ...base,
    challenge: {
      type: 'SELECT_METHOD',
      message: 'Verfahren wählen',
      methods: [{ id: 920, name: 'Test approval', media: ['Test phone'], mediaRequired: true }],
    },
  };
  let phase = 0,
    starts = 0;
  await page.route(
    '**/api/v1/bank-setup',
    /** Advertise configuration only inside this synthetic browser case. */ async (route) =>
      route.fulfill({ json: { configured: true, bankCode: '69050001', missing: [] } }),
  );
  await page.route(
    '**/api/v1/bank-connections',
    /** Supply a fictional bank connection with no real account. */ async (route) =>
      route.fulfill({
        json: [
          {
            id: connectionId,
            name: 'Synthetic FinTS',
            bankCode: '69050001',
            connectorType: 'FINTS',
            username: 'synthetic',
            status: 'ACTIVE',
          },
        ],
      }),
  );
  await page.route(
    `**/api/v1/bank-connections/${connectionId}/sync`,
    /** Never forward a PIN to a real adapter from this browser fixture. */ async (route) => {
      starts++;
      expect(route.request().postDataJSON().pin).toBe('CANARY_BROWSER_PIN');
      await route.fulfill({ status: 202, json: current });
    },
  );
  await page.route(
    `**/api/v1/import-runs/${runId}**`,
    /** Advance one explicit synthetic authorization phase per submitted choice. */ async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/cancel')) current = { ...base, status: 'CANCELLED' };
      else if (path.endsWith('/challenge')) {
        const body = route.request().postDataJSON();
        phase++;
        if (phase === 1) {
          expect(body.tanMethodId).toBe(920);
          current = { ...base, challenge: { type: 'SELECT_MEDIA', message: 'Medium wählen', media: ['Test phone'] } };
        } else if (phase === 2) {
          expect(body.tanMediaName).toBe('Test phone');
          current = { ...base, challenge: { type: 'TAN', message: 'Synthetische TAN erforderlich' } };
        } else if (phase === 3) {
          expect(body.tan).toBe('CANARY_BROWSER_TAN');
          current = { ...base, challenge: { type: 'APP_APPROVAL', message: 'Synthetische App-Freigabe' } };
        } else if (phase >= 5) current = { ...base, status: 'COMPLETED', importedCount: 1 };
      }
      await route.fulfill({ json: current });
    },
  );
  await page.goto('/connections');
  await page.getByLabel('Bank-PIN', { exact: true }).fill('CANARY_BROWSER_PIN');
  await page.getByRole('button', { name: 'Aktualisieren', exact: true }).click();
  await expect(page.getByLabel('Bank-PIN', { exact: true })).toHaveValue('');
  await page.getByLabel('TAN-Verfahren', { exact: true }).selectOption('920');
  await page.getByRole('button', { name: 'Fortsetzen', exact: true }).click();
  await page.getByLabel('TAN-Medium', { exact: true }).selectOption('Test phone');
  await page.getByRole('button', { name: 'Fortsetzen', exact: true }).click();
  await page.getByLabel('TAN', { exact: true }).fill('CANARY_BROWSER_TAN');
  await page.getByRole('button', { name: 'Fortsetzen', exact: true }).click();
  await expect(page.getByLabel('TAN', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Freigabe in Banking-App erfolgt' }).click();
  await expect(page.getByText('Synthetische App-Freigabe', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Freigabe in Banking-App erfolgt' }).click();
  await expect(page.getByText('Abgeschlossen', { exact: true })).toBeVisible();
  expect(starts).toBe(1);
  for (const errorCode of ['BANK_INVALID_CREDENTIALS', 'BANK_UNAVAILABLE', 'BANK_AUTH_TIMEOUT', 'BANK_AUTH_REJECTED']) {
    current = { ...base, status: 'FAILED', errorCode };
    await page.goto(`/connections?run=${runId}`);
    await expect(page.getByText(errorCode, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aktualisieren', exact: true })).toBeDisabled();
  }
  current = { ...base, status: 'RUNNING' };
  await page.goto(`/connections?run=${runId}`);
  await page.getByRole('button', { name: 'Abruf abbrechen', exact: true }).click();
  await expect(page.getByText('Abgebrochen', { exact: true })).toBeVisible();
  expect(starts).toBe(1);
  expect(
    await page.evaluate(
      /** Only an explicit theme preference may be retained; bank credentials never enter device storage. */ () =>
        JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
    ),
  ).not.toMatch(/CANARY_BROWSER_(PIN|TAN)/);
});
