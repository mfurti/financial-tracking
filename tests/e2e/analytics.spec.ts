import { test, expect } from './fixtures.js';
import { choose } from './controls.js';

test('multi-month analysis explains observed averages and drills into exact accountless classifications', /** Exercise real upload, report filters, chart rendering, exact tables and recoverable errors. */ async ({
  page,
}, info) => {
  const tag = `Analyse-${info.project.name}`;
  const errors: string[] = [];
  page.on(
    'pageerror',
    /** Capture UI failures without collecting any financial payload. */ (error) => errors.push(error.message),
  );
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Finanzieller Überblick' })).toBeVisible();
  await page.goto('/imports/csv');
  await page.getByLabel('CSV-Datei', { exact: true }).setInputFiles({
    name: 'analysis.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `Datum;Betrag;Text;Bankreferenz\n10.03.2025;-10,00;${tag} März;${tag}-1\n10.04.2025;-20,00;${tag} April;${tag}-2\n`,
    ),
  });
  await expect(page).toHaveURL(/month=2025-04/);
  await page.getByRole('link', { name: 'Analysen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Analysen', exact: true })).toBeVisible();
  const help = page.getByRole('button', { name: 'Hilfe: So liest du diese Zahlen', exact: true });
  await help.focus();
  await page.keyboard.press('Space');
  await expect(page.getByText(/Gebuchte Umsätze einschließlich Ohne Konto zählen/)).toBeVisible();
  await page.keyboard.press('Escape');
  const exactSection = page
    .locator('.section-block')
    .filter({ has: page.getByRole('heading', { name: 'Exakte Monatswerte', exact: true }) });
  await expect(exactSection.locator(':scope > .section-heading')).toContainText('Exakte Monatswerte');
  await expect(exactSection.locator('.panel h2')).toHaveCount(0);
  await page.goto('/analytics?from=2025-01-01&to=2025-05-31&unassigned=true');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(
    page.locator('.analytics-metrics section').filter({ hasText: 'Durchschnittliche Ausgaben' }),
  ).toContainText('15,00');
  await expect(
    page.locator('.analytics-metrics section').filter({ hasText: 'Durchschnittliche Ausgaben' }),
  ).toContainText('Ø aus 2 Monaten');
  await expect(page.getByText('Ausgabentrend:', { exact: false })).toContainText('10,00');
  await expect(page.getByRole('row').filter({ hasText: 'Januar 2025' })).toContainText('Keine Buchungen');
  await expect(page.getByRole('row').filter({ hasText: 'März 2025' })).toContainText('Berücksichtigt');
  await expect(page.getByRole('img', { name: 'Einnahmen und Ausgaben im Monatsverlauf', exact: true })).toBeVisible();
  await page.screenshot({ path: `.local/analytics-${info.project.name}.png`, fullPage: true });
  await expect(page.getByRole('heading', { name: 'Monatsrückblick', exact: true })).toBeVisible();
  await expect(
    page.locator('.finance-tile').filter({ hasText: 'Trend zum Vormonat' }).getByRole('link'),
  ).toHaveAttribute('href', /from=2025-04-01&to=2025-04-30/);
  await page.getByRole('button', { name: 'Ringdiagramme', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Ausgabenanteile im Monatsverlauf', exact: true })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('März 2025');
  await expect(page.getByRole('table')).toContainText('20,00');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ringdiagramme', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Balkendiagramme', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Einnahmen und Ausgaben im Monatsverlauf', exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const mode of ['light', 'dark'] as const) {
    const toggle = page.getByRole('button', { name: 'Dunkelmodus', exact: true });
    if ((await toggle.getAttribute('aria-pressed')) !== String(mode === 'dark')) await toggle.click();
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          /** Wide tables scroll locally rather than overflowing the page. */ () =>
            document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
      if (info.project.name === 'desktop')
        await page.screenshot({
          path: `.local/analytics-${mode}-${width}.png`,
          fullPage: true,
          animations: 'disabled',
        });
    }
  }
  await page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Fix oder variabel?', exact: true }) })
    .getByRole('link', { name: /Nicht eingeordnet/ })
    .click();
  await expect(page).toHaveURL(/classification=UNCLASSIFIED/);
  await expect(page.getByLabel('Fix/Variabel', { exact: true })).toContainText('Nicht eingeordnet');
  await expect(page.getByRole('link', { name: new RegExp(tag) })).toHaveCount(2);
  await page.goto('/analytics?from=2025-01-01&to=2025-05-31&unassigned=true');
  await choose(page, page.getByLabel('Kategorie', { exact: true }), 'Nicht kategorisiert');
  await page.getByRole('button', { name: 'Auswertung anzeigen', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Ausgaben nach Kategorien', exact: true }) })
    .getByRole('link', { name: /Nicht kategorisiert/ })
    .click();
  await expect(page).toHaveURL(/uncategorized=true/);
  await expect(page).toHaveURL(/unassigned=true/);
  await expect(page).toHaveURL(/analytics\/details/);
  await expect(page.getByRole('link', { name: new RegExp(tag) })).toHaveCount(2);
  await page.goto('/analytics?from=2025-01-01&to=2025-05-31');
  await page.route(
    '**/api/v1/analytics/overview?*',
    /** Fail one report refresh to verify old totals disappear. */ async (route) =>
      route.fulfill({
        status: 503,
        json: { error: { code: 'INTERNAL_ERROR', message: 'synthetic', requestId: 'synthetic' } },
      }),
  );
  await page.getByRole('button', { name: 'Auswertung anzeigen', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('table')).not.toBeVisible();
  await page.unroute('**/api/v1/analytics/overview?*');
  await page.getByRole('button', { name: 'Auswertung anzeigen', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  expect(errors).toEqual([]);
});

test('completed-month presets retain exact inclusive calendar windows on reload', /** Three, six and twelve months must end before the current Berlin month, even across year boundaries. */ async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Complete real authentication before selecting report windows. */ (url) => url.pathname === '/',
  );
  await page.goto('/analytics');
  await expect(page.getByRole('table')).toBeVisible();
  const lastDay = await page.evaluate(
    /** Derive expected Berlin month-end using calendar dates, never monetary values. */ () => {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
      const end = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
      end.setUTCDate(0);
      return end.toISOString().slice(0, 10);
    },
  );
  for (const count of [3, 6, 12]) {
    await page.getByRole('button', { name: `${count} Monate`, exact: true }).click();
    await expect(page.getByRole('row')).toHaveCount(count + 1);
    expect(new URL(page.url()).searchParams.get('to')).toBe(lastDay);
    const first = new Date(`${lastDay.slice(0, 7)}-01T12:00:00Z`);
    first.setUTCMonth(first.getUTCMonth() - count + 1);
    expect(new URL(page.url()).searchParams.get('from')).toBe(first.toISOString().slice(0, 10));
  }
  await page.reload();
  await expect(page.getByRole('row')).toHaveCount(13);
  expect(new URL(page.url()).searchParams.get('to')).toBe(lastDay);
});
