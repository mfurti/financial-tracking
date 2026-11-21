import { test, expect, conceptFixtureLabels } from './fixtures.js';

test('groups retain exact report, detail and calendar scope through failure, reload and deletion', /** Overlap never double-counts, empty never means all, and deleting metadata preserves real accounts and bookings. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Complete authentication before selecting existing real account references. */ (url) => url.pathname === '/',
  );
  const before = await (await page.request.get('/api/v1/transactions?limit=100')).json();
  const accounts = await (await page.request.get('/api/v1/accounts')).json();
  const checking = accounts.find(
    /** Resolve the actual fixture identity rather than an invented ID. */ (account: { name: string }) =>
      account.name === conceptFixtureLabels.checking,
  );
  const savings = accounts.find(
    /** Preserve a second member whose own transfers must stay excluded. */ (account: { name: string }) =>
      account.name === conceptFixtureLabels.savings,
  );
  await page.goto('/settings');
  await page.getByRole('link', { name: /^Kontogruppen/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Kontogruppen', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kontogruppe anlegen', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Kontogruppe bearbeiten', exact: true });
  await editor.getByRole('button', { name: 'Kontogruppe speichern', exact: true }).click();
  await expect(editor.getByLabel('Gruppenname', { exact: true })).toBeFocused();
  await editor.getByLabel('Gruppenname', { exact: true }).fill('Gemeinsame Haushaltskonten');
  await editor.getByRole('checkbox', { name: checking.name, exact: true }).check();
  await editor.getByRole('checkbox', { name: savings.name, exact: true }).check();
  await page.route(
    '**/api/v1/account-groups',
    /** Reject only the first metadata write without replacing any real source response. */ async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'UNAVAILABLE', message: 'Temporary groups failure' }),
      });
    },
  );
  await editor.getByRole('button', { name: 'Kontogruppe speichern', exact: true }).click();
  await expect(editor.getByRole('alert')).toBeVisible();
  await expect(editor.getByRole('checkbox', { name: checking.name, exact: true })).toBeChecked();
  await page.unroute('**/api/v1/account-groups');
  await editor.getByRole('button', { name: 'Kontogruppe speichern', exact: true }).click();
  await expect(editor).toBeHidden();
  let savedGroups = await (await page.request.get('/api/v1/account-groups')).json();
  const primary = savedGroups.find(
    /** Use only the group actually committed by the UI. */ (group: { name: string }) =>
      group.name === 'Gemeinsame Haushaltskonten',
  );
  expect(new Set(primary.accountIds)).toEqual(new Set([checking.id, savings.id]));
  await page.getByRole('button', { name: 'Kontogruppe anlegen', exact: true }).click();
  await editor.getByLabel('Gruppenname', { exact: true }).fill('Überlappende Gruppe');
  await editor.getByRole('checkbox', { name: checking.name, exact: true }).check();
  await editor.getByRole('button', { name: 'Kontogruppe speichern', exact: true }).click();
  await expect(editor).toBeHidden();
  await page.getByRole('button', { name: 'Kontogruppe anlegen', exact: true }).click();
  await editor.getByLabel('Gruppenname', { exact: true }).fill('Leere Gruppe');
  await expect(editor).toContainText('Leere Gruppe: Auswertungen finden keine Konten.');
  await editor.getByRole('button', { name: 'Kontogruppe speichern', exact: true }).click();
  await expect(editor).toBeHidden();
  savedGroups = await (await page.request.get('/api/v1/account-groups')).json();
  const empty = savedGroups.find(
    /** An explicitly empty group remains a real saved identity. */ (group: { name: string }) =>
      group.name === 'Leere Gruppe',
  );
  await page.reload();
  await expect(page.locator(`[data-account-group="${primary.id}"]`)).toContainText(checking.name);
  await page
    .locator(`[data-account-group="${primary.id}"]`)
    .getByRole('button', { name: 'Bearbeiten', exact: true })
    .click();
  await editor.getByLabel('Gruppenname', { exact: true }).fill('Verworfener Gruppenname');
  await editor.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(page.locator(`[data-account-group="${primary.id}"]`)).toContainText('Gemeinsame Haushaltskonten');
  await page
    .locator(`[data-account-group="${primary.id}"]`)
    .getByRole('link', { name: 'Gruppenanalyse', exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`groupId=${primary.id}`));
  await page.goto(`/analytics?from=2026-10-01&to=2026-10-31&groupId=${primary.id}`);
  await page.getByText('Zeitraum und Filter', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Konto', exact: true })).toContainText(
    'Kontogruppe: Gemeinsame Haushaltskonten',
  );
  await page.getByRole('link', { name: new RegExp(conceptFixtureLabels.merchant) }).click();
  await expect(page).toHaveURL(new RegExp(`groupId=${primary.id}`));
  await expect(page.locator('[data-analysis-total]')).toHaveText('99,99 €');
  await expect(page.getByText(/Kontogruppe: Gemeinsame Haushaltskonten/)).toBeVisible();
  await page.getByRole('link', { name: /Einkauf Oktober/ }).click();
  await page.getByRole('link', { name: 'Zur Analyse zurück', exact: true }).click();
  await expect(page.locator('[data-analysis-total]')).toHaveText('99,99 €');
  await expect(page).toHaveURL(new RegExp(`groupId=${primary.id}`));
  await page.getByRole('link', { name: 'Alle zugehörigen Umsätze', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`groupId=${primary.id}`));
  await expect(page.getByText('Kontolose CSV Ausgabe', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Einkauf Oktober', { exact: true })).toBeVisible();
  await page.goto(`/analytics/details?from=2026-10-01&to=2026-10-31&groupId=${empty.id}`);
  await expect(page.locator('[data-analysis-total]')).toHaveText('0,00 €');
  await expect(page.getByText('Keine zugehörigen Buchungen im gewählten Zeitraum.', { exact: true })).toBeVisible();
  await page.goto(`/contracts/calendar?month=2026-11&groupId=${empty.id}`);
  await expect(page.getByRole('region', { name: 'Geplante Fälligkeiten im Monat', exact: true })).toContainText(
    '0,00 €',
  );
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`groupId=${empty.id}`));
  await expect(page.getByRole('button', { name: 'Kalenderkonto', exact: true })).toContainText(
    'Kontogruppe: Leere Gruppe',
  );
  await page.goto(`/contracts/analysis?groupId=${empty.id}`);
  await expect(page.getByRole('region', { name: 'Monatliche Fixkosten', exact: true })).toContainText('0,00 €');
  await page.goto('/?month=2026-11');
  const picker = page.getByRole('button', { name: 'Kontogruppen wählen', exact: true });
  const groups = page.getByRole('dialog', { name: 'Kontogruppen', exact: true });
  const preview = page.locator('[data-overview-section="bookings"]');
  await picker.click();
  await groups.getByRole('button', { name: 'Gemeinsame Haushaltskonten', exact: true }).click();
  await expect(groups).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`groupId=${primary.id}`));
  await expect(preview.getByRole('link', { name: 'Alle Umsätze', exact: true })).toHaveAttribute(
    'href',
    new RegExp(`groupId=${primary.id}`),
  );
  await page.reload();
  await expect(picker).toHaveText('Gemeinsame Haushaltskonten');
  await expect(page.locator('[data-overview-section="accounts"]')).toContainText(checking.name);
  await picker.click();
  await groups.getByRole('button', { name: 'Leere Gruppe', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`groupId=${empty.id}`));
  await expect(preview.getByText(/In diesem Monat sind noch keine Buchungen vorhanden/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Monatsbilanz', exact: true })).toContainText('0,00 €');
  await picker.click();
  await groups.getByRole('button', { name: 'Alle Konten', exact: true }).click();
  await expect(page).toHaveURL(/\?month=2026-11$/);
  await expect(preview.getByRole('link', { name: 'Alle Umsätze', exact: true })).toBeVisible();
  await page.goto('/settings/account-groups');
  const row = page.locator(`[data-account-group="${primary.id}"]`);
  await row.getByRole('button', { name: 'Löschen', exact: true }).click();
  const deletion = page.getByRole('dialog', { name: 'Kontogruppe löschen', exact: true });
  await deletion.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Löschen', exact: true }).click();
  await deletion.getByRole('button', { name: 'Kontogruppe löschen', exact: true }).click();
  await expect(deletion).toBeHidden();
  await expect(row).toHaveCount(0);
  expect(await (await page.request.get('/api/v1/transactions?limit=100')).json()).toEqual(before);
  expect(await (await page.request.get('/api/v1/accounts')).json()).toEqual(accounts);
  expect(
    await page.evaluate(
      /** Long account/group names cannot widen the viewport. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: `.local/concept-account-groups-${info.project.name}.png`, fullPage: true });
  await page.goto(`/analytics/details?from=2026-10-01&to=2026-10-31&groupId=${primary.id}`);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('[data-analysis-total]')).toHaveCount(0);
});
