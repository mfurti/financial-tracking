import { choose } from './controls.js';
import { test, expect } from './fixtures.js';

/** Sign in only to the disposable browser fixture, never a real bank or production account. */
async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Finanzieller Überblick' })).toBeVisible();
}

test('upload alone opens full-period analytics and recovers a lost commit response', /** Persist real decoded bank rows once, without manual setup or confirmation. */ async ({
  page,
}, info) => {
  await signIn(page);
  const beforeAccounts = await (await page.request.get('/api/v1/accounts')).json();
  const label = `Auto ${info.project.name} Müller`;
  const rows = Array.from(
    { length: 22 },
    /** Keep each synthetic payment financially distinct. */ (_, index) =>
      `TEST;${index === 21 ? '20.12.26' : '01.10.26'};${index === 21 ? '20.12.26' : '01.10.26'};SEPA;${label} ${index};Testladen;DE89370400440532013000;-${index + 1},00;EUR;auto-${info.project.name}-${index}`,
  );
  let commits = 0;
  await page.route(
    '**/api/v1/imports/csv/*/commit',
    /** Lose only the response after the actual database transaction completed. */ async (route) => {
      commits++;
      await route.fetch();
      await route.abort('failed');
    },
  );
  await page.goto('/imports/csv');
  await page.getByLabel('CSV-Datei', { exact: true }).setInputFiles({
    name: 'bank.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `Auftragskonto;Buchungstag;Valutadatum;Buchungstext;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Kontonummer/IBAN;Betrag;Waehrung;Bankreferenz\n${rows.join('\n')}\n`,
      'latin1',
    ),
  });
  await expect(page).toHaveURL(/month=2026-12/);
  await expect(page.getByText('Datei ausgewertet', { exact: true })).toBeVisible();
  expect(commits).toBe(1);
  const records = await (await page.request.get(`/api/v1/transactions?search=${encodeURIComponent(label)}`)).json();
  expect(records.items).toHaveLength(22);
  expect(
    records.items.every(
      /** A bank export must not silently create a target account. */ (row: { accountId: string | null }) =>
        row.accountId === null,
    ),
  ).toBe(true);
  expect(
    records.items.some(
      /** Prefer the actual purpose, not the generic SEPA booking type. */ (row: { description: string }) =>
        row.description === `${label} 21`,
    ),
  ).toBe(true);
  expect(await (await page.request.get('/api/v1/accounts')).json()).toEqual(beforeAccounts);
  await page.goto('/imports');
  const entry = page.locator('.import-entry').filter({ hasText: '22 neu' });
  await entry.getByRole('button', { name: 'Import rückgängig machen', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import rückgängig machen?', exact: true });
  await expect(dialog).toContainText('22 Buchungen werden gelöscht.');
  await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  expect(
    (await (await page.request.get(`/api/v1/transactions?search=${encodeURIComponent(label)}`)).json()).items,
  ).toHaveLength(22);
  await entry.getByRole('button', { name: 'Import rückgängig machen', exact: true }).click();
  await dialog.getByRole('button', { name: 'Import zurücknehmen', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    (await (await page.request.get(`/api/v1/transactions?search=${encodeURIComponent(label)}`)).json()).items,
  ).toHaveLength(0);
  await page.goto('/imports/csv');
  await page.getByLabel('CSV-Datei', { exact: true }).setInputFiles({
    name: 'bank.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `Auftragskonto;Buchungstag;Valutadatum;Buchungstext;Verwendungszweck;Beguenstigter/Zahlungspflichtiger;Kontonummer/IBAN;Betrag;Waehrung;Bankreferenz\n${rows.join('\n')}\n`,
      'latin1',
    ),
  });
  await expect(page).toHaveURL(/month=2026-12/);
  expect(
    (await (await page.request.get(`/api/v1/transactions?search=${encodeURIComponent(label)}`)).json()).items,
  ).toHaveLength(22);
});

test('only real format, mapping and invalid-row exceptions need input; abandoned previews cannot navigate later', /** Preserve consent and lifecycle ownership while simplifying the normal workflow. */ async ({
  page,
}, info) => {
  await signIn(page);
  const label = `Recovery ${info.project.name}`;
  await page.goto('/imports/csv');
  await page.getByText('Importoptionen (nur bei Bedarf)', { exact: true }).click();
  await choose(page, page.getByLabel('Kodierung', { exact: false }), 'UTF-8');
  await page.getByLabel('CSV-Datei', { exact: true }).setInputFiles({
    name: 'legacy.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`Datum;Betrag;Text\n05.11.2026;-31,00;${label} Müller\n`, 'latin1'),
  });
  await expect(page.getByRole('alert')).toContainText('anderen Textformat');
  await choose(page, page.getByLabel('Kodierung', { exact: false }), 'Automatisch (empfohlen)');
  await expect(page).toHaveURL(/month=2026-11/);
  await page.goto('/imports/csv');
  await page.getByLabel('CSV-Datei', { exact: true }).setInputFiles({
    name: 'partial.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`Datum;Betrag;Text\n06.11.2026;-32,00;${label} gültig\n31.02.2026;-33,00;${label} ungültig\n`),
  });
  await expect(page.getByRole('heading', { name: 'Einmal kurz prüfen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gültige Buchungen übernehmen' })).toBeDisabled();
  expect(
    (await (await page.request.get(`/api/v1/transactions?search=${encodeURIComponent(label + ' gültig')}`)).json())
      .items,
  ).toHaveLength(0);
  await page.getByRole('checkbox', { name: 'Nur gültige Zeilen übernehmen; fehlerhafte Zeilen auslassen.' }).check();
  await page.getByRole('button', { name: 'Gültige Buchungen übernehmen' }).click();
  await expect(page).toHaveURL(/month=2026-11/);
  await page.goto('/imports/csv');
  await page.getByLabel('CSV-Datei', { exact: true }).setInputFiles({
    name: 'unknown.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`Tag;Summe;Hinweis\n07.11.2026;-34,00;${label} zugeordnet\n`),
  });
  await expect(page.getByRole('heading', { name: 'Eine kurze Zuordnung fehlt' })).toBeVisible();
  await choose(page, page.getByRole('button', { name: /^Buchungsdatum/ }), 'Tag');
  await choose(page, page.getByRole('button', { name: /^Betrag/ }), 'Summe');
  await choose(page, page.getByRole('button', { name: /^Buchungstext/ }), 'Hinweis');
  await page.getByRole('button', { name: 'Jetzt auswerten' }).click();
  await expect(page).toHaveURL(/month=2026-11/);

  let release: () => void = () => {};
  let started: () => void = () => {};
  let runId = '';
  const held = new Promise<void>(
    /** Hold a real created preview until its component has gone. */ (resolve) => {
      release = resolve;
    },
  );
  const staged = new Promise<void>(
    /** Observe the server-created ID without mocking its data. */ (resolve) => {
      started = resolve;
    },
  );
  await page.route(
    '**/api/v1/imports/csv/preview',
    /** Deliver the genuine preview late. */ async (route) => {
      const response = await route.fetch();
      runId = (await response.json()).run.id;
      started();
      await held;
      await route.fulfill({ response });
    },
  );
  try {
    await page.goto('/imports/csv');
    await page.getByLabel('CSV-Datei', { exact: true }).setInputFiles({
      name: 'abandon.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`Datum;Betrag;Text\n08.11.2026;-35,00;${label} verlassen\n`),
    });
    await staged;
    if (info.project.name === 'mobile') await page.getByRole('link', { name: 'Mehr', exact: true }).click();
    await page
      .getByRole('navigation', { name: info.project.name === 'mobile' ? 'Weitere Seiten' : 'Verwaltung', exact: true })
      .getByRole('link', { name: 'Einstellungen', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Einstellungen', exact: true })).toBeVisible();
    release();
    await expect
      .poll(
        /** An abandoned stage is cancelled, never committed by a late response. */ async () =>
          (await (await page.request.get(`/api/v1/import-runs/${runId}`)).json()).status,
      )
      .toBe('CANCELLED');
    await expect(page).toHaveURL(/settings$/);
  } finally {
    release();
    await page.unroute('**/api/v1/imports/csv/preview');
  }
});
