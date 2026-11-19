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
  const entry = page
    .locator('.import-entry')
    .filter({ has: page.getByText('22 neu · 0 bekannt · 0 prüfen', { exact: true }) });
  await entry.getByRole('button', { name: 'Import rückgängig machen', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import rückgängig machen?', exact: true });
  await expect(dialog).toHaveClass(/finance-dialog/);
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

test('compact import reviews retain explicit candidate drafts across failures', /** Expand/collapse real duplicate comparisons without losing selection or silently replacing bookings. */ async ({
  page,
}, info) => {
  await signIn(page);
  const label = `Compact review ${info.project.name}`;
  const buffer = Buffer.from(`Datum;Betrag;Text\n17.02.2034;-717,37;${label}\n`);
  for (let repeat = 0; repeat < 2; repeat++) {
    await page.goto('/imports/csv');
    await page
      .getByLabel('CSV-Datei', { exact: true })
      .setInputFiles({ name: 'review.csv', mimeType: 'text/csv', buffer });
    await expect(page).toHaveURL(repeat ? /\/imports\?run=/ : /month=2034-02/);
  }
  const review = page.locator('[data-import-issue]').filter({ hasText: label });
  await expect(review).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Mögliche Doppelbuchungen', exact: true })).toBeVisible();
  await choose(page, review.getByRole('button', { name: 'Bekannte Buchung auswählen', exact: true }), { index: 1 });
  const selected = await review.getByRole('button', { name: 'Bekannte Buchung auswählen', exact: true }).textContent();
  const disclosure = review.locator('summary');
  await disclosure.focus();
  await page.keyboard.press('Enter');
  await expect(review.getByRole('button', { name: 'Vorhandene Daten behalten', exact: true })).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(review.getByRole('button', { name: 'Bekannte Buchung auswählen', exact: true })).toHaveText(selected!);
  await page.route(
    '**/api/v1/imports/*/resolutions',
    /** Reject a deliberate mutation without losing the displayed draft. */ async (route) =>
      route.fulfill({
        status: 503,
        json: { error: { code: 'TEMPORARY', message: 'Prüfung später erneut versuchen.' } },
      }),
  );
  await review.getByRole('button', { name: 'Vorhandene Daten behalten', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Der Dienst ist gerade nicht verfügbar. Bitte versuche es später erneut.',
  );
  await expect(review.getByRole('button', { name: 'Bekannte Buchung auswählen', exact: true })).toHaveText(selected!);
  expect(
    (await (await page.request.get(`/api/v1/transactions?search=${encodeURIComponent(label)}`)).json()).items,
  ).toHaveLength(1);
  await page.unroute('**/api/v1/imports/*/resolutions');
  await page.screenshot({ path: `.local/concept-import-review-${info.project.name}.png`, fullPage: true });
  await review.getByRole('button', { name: 'Vorhandene Daten behalten', exact: true }).click();
  await expect(page.getByText('Keine offenen Hinweise für diesen Import.', { exact: true })).toBeVisible();
  expect(
    (await (await page.request.get(`/api/v1/transactions?search=${encodeURIComponent(label)}`)).json()).items,
  ).toHaveLength(1);
});

test('mixed purpose and booking text imports once and empty pairs require consent', /** Keep source text, stable reimport identities and explicit manual fallback choices. */ async ({
  page,
}, info) => {
  await signIn(page);
  const label = `Fallback ${info.project.name}`;
  const target = (await (await page.request.get('/api/v1/accounts')).json())[0] as { id: string; name: string };
  const buffer = Buffer.from(
    `Datum;Betrag;Verwendungszweck;Buchungstext\n09.11.2026;-1,00;${label} Zweck;SEPA\n10.11.2026;-2,00; ;${label} Karte\n11.11.2026;-3,00; ; \n`,
  );
  for (let repeat = 0; repeat < 2; repeat++) {
    await page.goto('/imports/csv');
    await page.getByRole('button', { name: 'Importoptionen (nur bei Bedarf)', exact: true }).click();
    await choose(page, page.getByLabel('Zielkonto (optional)', { exact: true }), target.name);
    const fileChoice = page.waitForEvent('filechooser');
    const upload = page.getByRole('button', { name: /CSV-Datei auswählen/ });
    if (info.project.name === 'mobile') await upload.tap();
    else {
      await upload.focus();
      await page.keyboard.press('Enter');
    }
    await (await fileChoice).setFiles({ name: 'mixed.csv', mimeType: 'text/csv', buffer });
    await expect(page.getByRole('heading', { name: 'Einmal kurz prüfen' })).toBeVisible();
    await expect(page.getByText('3 Zeilen · 1 fehlerhaft', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gültige Buchungen übernehmen' })).toBeDisabled();
    await page.getByRole('checkbox', { name: 'Nur gültige Zeilen übernehmen; fehlerhafte Zeilen auslassen.' }).check();
    await page.getByRole('button', { name: 'Gültige Buchungen übernehmen' }).click();
    await expect(page).toHaveURL(/month=2026-11/);
  }
  const records = await (await page.request.get(`/api/v1/transactions?search=${encodeURIComponent(label)}`)).json();
  expect(records.items).toHaveLength(2);
  expect(
    records.items
      .map(
        /** Reimport must preserve the useful original texts without creating duplicate payments. */ (row: {
          description: string;
        }) => row.description,
      )
      .sort(),
  ).toEqual([`${label} Karte`, `${label} Zweck`]);
  await page.goto('/imports/csv');
  await page.getByLabel('CSV-Datei', { exact: true }).setInputFiles({
    name: 'manual-fallback.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`Tag;Summe;Hinweis;Ersatz\n12.11.2026;-4,00;;${label} manuell\n`),
  });
  await choose(page, page.getByRole('button', { name: /^Buchungsdatum/ }), 'Tag');
  await choose(page, page.getByRole('button', { name: /^Betrag/ }), 'Summe');
  await choose(page, page.getByRole('button', { name: /^Buchungstext/ }), 'Hinweis');
  await page.getByRole('button', { name: 'Weitere Angaben zuordnen (optional)', exact: true }).click();
  await choose(page, page.getByRole('button', { name: /^Buchungstext bei leerer Beschreibung/ }), 'Ersatz');
  await page.getByRole('button', { name: 'Jetzt auswerten' }).click();
  await expect(page).toHaveURL(/month=2026-11/);
  expect(
    (await (await page.request.get(`/api/v1/transactions?search=${encodeURIComponent(label + ' manuell')}`)).json())
      .items,
  ).toHaveLength(1);
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
    await page.getByRole('link', { name: 'Mehr', exact: true }).click();
    await page
      .getByRole('navigation', { name: 'Weitere Seiten', exact: true })
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
