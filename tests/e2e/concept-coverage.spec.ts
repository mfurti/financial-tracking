import { mkdir, writeFile } from 'node:fs/promises';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect, conceptFixtureLabels } from './fixtures.js';
import { choose } from './controls.js';
import * as c from '../../packages/contracts/src/index.js';
import { en } from '../../apps/web/app/locales/en.js';
import { verifyContrast } from './appearance-checks.js';

/** The original 39 source identities remain independently accounted for, including integrated inline workflows. */
const sourceViews = [
  'seite-03',
  'seite-04',
  'seite-05',
  'analysis-details',
  'seite-07',
  'seite-08',
  'konten',
  'konto-detail',
  'scalable',
  'sparplaene',
  'scalable-umsatz',
  'wertpapier',
  'seite-17',
  'verbindungen',
  'darstellung',
  'seite-02',
  'seite-09',
  'seite-10',
  'seite-13',
  'seite-14',
  'seite-18',
  'seite-19',
  'seite-20',
  'seite-21',
  'seite-22',
  'seite-23',
  'seite-24',
  'seite-25',
  'seite-26',
  'seite-06',
  'einstellungen',
  'theme-konfigurator',
  'profil',
  'benachrichtigungen',
  'banken',
  'benutzer',
  'kontogruppen',
  'passwort',
  'vertragskalender',
];
/** Geometry-only evidence never serializes source financial payloads, credentials or input values. */
type SurfaceEvidence = {
  id: string;
  path: string;
  viewport: { width: number; height: number } | null;
  surfaces: {
    selector: string;
    radius: string;
    padding: string;
    gap: string;
    shadow: string;
    transform: string;
    minHeight: string;
    fontSize: string;
    columns: string;
  }[];
};

/** Wait for actual rendered state, fonts and compositor frames rather than hiding a transient loading screenshot. */
async function settle(page: Page) {
  await expect(page.locator('[aria-busy="true"], [data-state="loading"]')).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: /(?:wird|werden|Dein Monat|Deine Auswertung).*geladen|^Loading/i }),
  ).toHaveCount(0);
  await page.evaluate(
    /** Font readiness and two paint opportunities make geometry comparable without a fixed delay. */ async () => {
      await document.fonts.ready;
      await new Promise<void>(
        /** Wait until layout has reached the next compositor frame. */ (resolve) =>
          requestAnimationFrame(
            /** Let font/layout invalidations finish before capture. */ () =>
              requestAnimationFrame(/** Resolve after the second frame. */ () => resolve()),
          ),
      );
    },
  );
}

/** Capture the actual named source destination and inspect meaningful layer geometry on every viewport. */
async function capture(page: Page, info: TestInfo, language: 'de' | 'en', id: string, evidence: SurfaceEvidence[]) {
  await settle(page);
  const dialog = (await page.getByRole('dialog').count()) > 0;
  if (!dialog)
    await page.evaluate(/** Sticky chrome is captured from its settled top position. */ () => window.scrollTo(0, 0));
  const surfaces = await page.evaluate(
    /** Keep measured tokens separate from page content. */ () =>
      [
        '.page-content',
        '.finance-overview-columns',
        '.finance-overview-column',
        '.settings-links',
        '.finance-feature-grid',
        '.finance-analysis-hub',
        '.section-heading',
        '.finance-tile--account',
        '.finance-tile--insight',
        '.finance-tile',
        '.finance-tile__main',
        '.finance-tile__label',
        '.finance-tile__value',
        '.finance-tile__context',
        '.finance-dialog',
      ].flatMap(
        /** Measure a representative visible surface for each shared geometry owner. */ (selector) => {
          const element = document.querySelector(selector);
          if (!element) return [];
          const css = getComputedStyle(element);
          return [
            {
              selector,
              radius: css.borderRadius,
              padding: css.padding,
              gap: css.gap,
              shadow: css.boxShadow,
              transform: css.transform,
              minHeight: css.minHeight,
              fontSize: css.fontSize,
              columns: css.gridTemplateColumns,
            },
          ];
        },
      ),
  );
  evidence.push({ id, path: new URL(page.url()).pathname, viewport: page.viewportSize(), surfaces });
  if (id !== 'seite-02') {
    await expect(page.locator('.page-content')).toHaveCSS('max-width', '1480px');
    await expect(page.locator('.page-content')).toHaveCSS(
      'padding-left',
      page.viewportSize()!.width <= 700 ? '17px' : '32px',
    );
  }
  const primary = [390, 768, 1440].includes(page.viewportSize()!.width);
  if (
    primary ||
    [
      'seite-03',
      'seite-06',
      'konten',
      'scalable',
      'einstellungen',
      'seite-23',
      'theme-konfigurator',
      'seite-04',
      'seite-25',
    ].includes(id)
  )
    await page.screenshot({
      path: `.local/concept-implementation/${info.project.name}-${language}-${id}.png`,
      fullPage: !dialog,
    });
  expect(
    await page.evaluate(
      /** Never mask overflow to satisfy the audit. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
    id,
  ).toBe(true);
  if (await page.locator('.finance-brand strong').count()) {
    const spacing = await page.evaluate(
      /** The wordmark must not collide with independently focusable header controls. */ () => {
        const word = document.querySelector('.finance-brand strong')!.getBoundingClientRect(),
          controls = document.querySelector('.finance-tools')!.getBoundingClientRect();
        return controls.left - word.right;
      },
    );
    expect(spacing, `${id}: header text/control clearance`).toBeGreaterThanOrEqual(7);
  }
}

for (const language of ['de', 'en'] as const) {
  test(`all 39 source views remain reachable and readable (${language})`, /** Actual routes, inline replacements and dialogs are audited without confirming destructive/product changes. */ async ({
    page,
  }, info) => {
    test.setTimeout(180000);
    const width = info.project.use.viewport!.width;
    if (width === 768) await page.setViewportSize({ width, height: 1024 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.addInitScript(
      /** Restore only source-owned device choices before the app starts. */ (locale) => {
        if (!localStorage.getItem('haushaltsbuch-workspace-v1'))
          localStorage.setItem(
            'haushaltsbuch-workspace-v1',
            JSON.stringify({ version: 1, language: locale, maskAmounts: false }),
          );
        localStorage.setItem('haushaltsbuch-theme', 'light');
      },
      language,
    );
    /** Translate test labels with the same reviewed dictionary, never imported source names. */
    const label = (source: string) => (language === 'en' ? (en[source as keyof typeof en] ?? source) : source);
    const evidence: SurfaceEvidence[] = [];
    await mkdir('.local/concept-implementation', { recursive: true });
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: label('Anmelden'), exact: true })).toBeVisible();
    await capture(page, info, language, 'seite-02', evidence);
    await page.getByLabel(label('Benutzername'), { exact: true }).fill('e2e');
    await page.getByLabel(label('Passwort'), { exact: true }).fill('e2e-test-password-only');
    await page.getByRole('button', { name: label('Anmelden'), exact: true }).click();
    await page.waitForURL(
      /** Complete the real singleton-owner login before resolving source references. */ (url) => url.pathname === '/',
    );
    const session = c.sessionSchema.parse(await (await page.request.get('/api/v1/auth/session')).json());
    const headers = { origin: new URL(page.url()).origin, 'x-csrf-token': session.csrfToken };
    const accounts = c.accountSchema.array().parse(await (await page.request.get('/api/v1/accounts')).json());
    const checking = accounts.find(
      /** Use a real synthetic historical account. */ (account) => account.name === conceptFixtureLabels.checking,
    )!;
    const transactions = c.transactionPageSchema.parse(
      await (await page.request.get('/api/v1/transactions?limit=100')).json(),
    );
    const booking = transactions.items.find(
      /** Detail remains distinct from the accountless assignment view. */ (row) =>
        row.accountId === checking.id && !row.isTransfer,
    )!;
    const unassigned = transactions.items.find(
      /** Existing accountless history is preserved and merely previewed. */ (row) => row.accountId === null,
    )!;
    const contracts = c.contractSchema.array().parse(await (await page.request.get('/api/v1/contracts')).json());
    const contract = contracts.find(
      /** Resolve the confirmed fixture contract without inventing a deep link. */ (row) =>
        row.name === conceptFixtureLabels.contract,
    )!;
    const routes: [string, string, string][] = [
      ['seite-03', '/?month=2026-11', 'Finanzieller Überblick'],
      ['seite-04', '/transactions', 'Deine Umsätze'],
      ['seite-05', `/transactions/${booking.id}`, 'Umsatzdetails'],
      ['analysis-details', '/analytics/details?from=2026-10-01&to=2026-10-31', 'Einnahmen und Ausgaben'],
      ['seite-07', '/categories?month=2026-11', 'Kategorien & Auswertung'],
      ['seite-08', '/contracts', 'Verträge'],
      ['konten', '/accounts', 'Deine Konten'],
      ['konto-detail', `/accounts/${checking.id}`, checking.name],
      ['scalable', '/wealth', 'Vermögen'],
      ['sparplaene', '/wealth/demo/plans', 'Demo-Sparpläne'],
      ['scalable-umsatz', '/wealth/demo/activity', 'Demo-Aktivität'],
      ['wertpapier', '/wealth/demo/securities/demo-world', 'Demo Weltfonds'],
      ['seite-17', '/more', 'Mehr'],
      ['verbindungen', '/connections', 'Bankverbindungen'],
      ['darstellung', '/settings/appearance', 'Darstellung'],
      ['seite-09', `/contracts/${contract.id}`, contract.name],
      ['seite-10', '/contracts/analysis', 'Vertragsanalyse'],
      ['seite-13', '/imports', 'Importhistorie'],
      ['seite-14', '/imports/csv', 'CSV importieren'],
      ['seite-06', '/analytics?from=2026-07-01&to=2026-10-31', 'Analysen'],
      ['einstellungen', '/settings', 'Einstellungen'],
      ['theme-konfigurator', '/settings/appearance/custom', 'Eigene Farben'],
      ['profil', '/settings/profile', 'Mein Profil'],
      ['benachrichtigungen', '/notifications', 'Benachrichtigungen'],
      ['banken', '/accounts/add', 'Konto hinzufügen'],
      ['benutzer', '/settings/users', 'Lokale Demo-Rollen'],
      ['kontogruppen', '/settings/account-groups', 'Kontogruppen'],
      ['passwort', '/settings/password', 'Passwort ändern'],
      ['vertragskalender', '/contracts/calendar?month=2026-11', 'Vertragskalender'],
    ];
    for (const [id, path, title] of routes) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: label(title), exact: true })).toBeVisible();
      if (id === 'analysis-details') await expect(page.locator('[data-analysis-total]')).toBeVisible();
      if (id === 'scalable')
        await expect(page.getByRole('region', { name: label('Aktuelle Quellen'), exact: true })).toBeVisible();
      if (language === 'en' && id === 'seite-03') {
        const bookings = page.locator('[data-overview-section="bookings"]');
        await expect(bookings.getByText(/Uncategorised/).first()).toBeVisible();
        await expect(bookings.getByText(/Nicht kategorisiert/)).toHaveCount(0);
      }
      if (language === 'en' && id === 'seite-06') {
        await expect(page.locator('.contract-list-row').filter({ hasText: 'Uncategorised' }).first()).toBeVisible();
        await expect(page.getByRole('link').filter({ hasText: 'Unknown merchant' }).first()).toBeVisible();
        await expect(page.getByText('Nicht kategorisiert', { exact: true })).toHaveCount(0);
        await expect(page.getByText('Unbekannter Händler', { exact: true })).toHaveCount(0);
      }
      if (language === 'en' && id === 'seite-10')
        await expect(page.getByRole('button').filter({ hasText: 'No category' }).first()).toBeVisible();
      await capture(page, info, language, id, evidence);
    }
    // Only owned disposable CSV fixtures create the real review states below; all are rolled back afterward.
    const runs: string[] = [];
    try {
      const content = `Datum;Betrag;Text;Gegenpartei\n15.09.2026;-12,00;Coverage recurring;Coverage provider\n15.10.2026;-12,00;Coverage recurring;Coverage provider\n15.11.2026;-12,00;Coverage recurring;Coverage provider\n31.02.2026;invalid;Coverage invalid;Coverage provider\n`;
      for (let repeat = 0; repeat < 2; repeat++) {
        const preview = c.csvPreviewSchema.parse(
          await (
            await page.request.post('/api/v1/imports/csv/preview', {
              headers,
              data: {
                content,
                mapping: {
                  bookingDate: 'Datum',
                  amount: 'Betrag',
                  description: 'Text',
                  counterpartyName: 'Gegenpartei',
                },
              },
            })
          ).json(),
        );
        runs.push(preview.run.id);
        expect(
          (
            await page.request.post(`/api/v1/imports/csv/${preview.run.id}/commit`, {
              headers,
              data: { allowPartial: true },
            })
          ).status(),
        ).toBe(201);
      }
      await page.goto(`/imports?run=${runs[1]}`);
      await expect(page.getByRole('heading', { name: label('Fehlerhafte Zeilen'), exact: true })).toBeVisible();
      await capture(page, info, language, 'seite-18', evidence);
      const duplicate = page.locator('[data-import-issue]').filter({ hasText: 'Coverage recurring' }).first();
      await expect(duplicate).toBeVisible();
      await choose(page, duplicate.getByRole('button', { name: label('Bekannte Buchung auswählen'), exact: true }), {
        index: 1,
      });
      await capture(page, info, language, 'seite-19', evidence);
      await page.goto(`/imports?run=${runs[0]}`);
      await page
        .locator('.import-entry')
        .filter({ has: page.locator('.import-row[aria-pressed="true"]') })
        .getByRole('button', { name: label('Import rückgängig machen'), exact: true })
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(
        page.getByRole('dialog').getByRole('button', { name: label('Import zurücknehmen'), exact: true }),
      ).toBeVisible();
      await capture(page, info, language, 'seite-20', evidence);
      await page.keyboard.press('Escape');
      await page.goto(`/transactions/${unassigned.id}`);
      await choose(
        page,
        page.getByRole('button', { name: label('Zielkonto für Zuordnung'), exact: true }),
        checking.name,
      );
      await page.getByRole('button', { name: label('Zuordnung vergleichen'), exact: true }).click();
      await expect(page.locator('.assignment-comparison')).toBeVisible();
      await capture(page, info, language, 'seite-21', evidence);
      await page.goto('/categories');
      await page.getByRole('button', { name: label('Regel erstellen'), exact: true }).click();
      await expect(page.getByRole('dialog', { name: label('Regel erstellen'), exact: true })).toBeVisible();
      await capture(page, info, language, 'seite-22', evidence);
      await page.keyboard.press('Escape');
      await page.goto('/contracts');
      await page.getByRole('button', { name: label('Vertrag anlegen'), exact: true }).click();
      await expect(page.getByRole('dialog', { name: label('Vertrag anlegen'), exact: true })).toBeVisible();
      await capture(page, info, language, 'seite-23', evidence);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: new RegExp(`^${label('Vorschläge prüfen ·')}`) }).click();
      await expect(page.getByRole('dialog', { name: label('Vertragsvorschläge prüfen'), exact: true })).toBeVisible();
      await capture(page, info, language, 'seite-24', evidence);
      await page.keyboard.press('Escape');
      await page.goto('/transactions?from=2026-10-01&to=2026-10-31');
      for (const row of transactions.items
        .filter(
          /** Existing transfer pair remains unchanged; the audit opens selection without submitting. */ (row) =>
            row.isTransfer,
        )
        .slice(0, 2))
        await page
          .getByRole('checkbox', {
            name: language === 'en' ? `Select ${row.description}` : `${row.description} auswählen`,
            exact: true,
          })
          .check();
      await expect(page.getByRole('button', { name: label('Umbuchung verknüpfen'), exact: true })).toBeVisible();
      await capture(page, info, language, 'seite-26', evidence);
      const connectionId = '20000000-0000-4000-8000-000000000001',
        runId = '20000000-0000-4000-8000-000000000002';
      const waiting: c.ImportRun = {
        id: runId,
        source: 'FINTS',
        status: 'WAITING_FOR_AUTH',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        importedCount: 0,
        knownCount: 0,
        reviewRequiredCount: 0,
        errorCode: null,
        challenge: {
          type: 'SELECT_METHOD',
          message: label('Verfahren wählen'),
          methods: [{ id: 920, name: 'Synthetic approval', media: [], mediaRequired: false }],
        },
      };
      await page.route(
        '**/api/v1/bank-setup',
        /** Configuration exists only within this synthetic visual fixture. */ async (route) =>
          route.fulfill({ json: { configured: true, bankCode: '69050001', missing: [] } }),
      );
      await page.route(
        '**/api/v1/bank-connections',
        /** No real connector or bank account is supplied to the preview. */ async (route) =>
          route.fulfill({
            json: [
              {
                id: connectionId,
                name: 'Synthetic visual bank',
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
        /** Intercept the entire explicit authorization start; no PIN reaches any adapter. */ async (route) =>
          route.fulfill({ status: 202, json: waiting }),
      );
      await page.route(
        `**/api/v1/import-runs/${runId}**`,
        /** Read/cancel only the fictional challenge; never forward a bank request. */ async (route) =>
          route.fulfill({
            json: route.request().url().endsWith('/cancel')
              ? { ...waiting, status: 'CANCELLED', challenge: null }
              : waiting,
          }),
      );
      await page.goto('/connections');
      await page.getByLabel(label('Bank-PIN'), { exact: true }).fill('SYNTHETIC_VISUAL_PIN');
      await page.getByRole('button', { name: label('Aktualisieren'), exact: true }).click();
      await expect(page.getByLabel(label('TAN-Verfahren'), { exact: true })).toBeVisible();
      await expect(page.getByLabel(label('Bank-PIN'), { exact: true })).toHaveValue('');
      await capture(page, info, language, 'seite-25', evidence);
      await page.goto('/settings');
      await page.unroute('**/api/v1/bank-setup');
      await page.unroute('**/api/v1/bank-connections');
      await page.unroute(`**/api/v1/bank-connections/${connectionId}/sync`);
      await page.unroute(`**/api/v1/import-runs/${runId}**`);
    } finally {
      await page.goto('/settings');
      for (const id of runs.reverse()) {
        const preview = c.rollbackPreviewSchema.parse(
          await (await page.request.get(`/api/v1/imports/${id}/rollback-preview`)).json(),
        );
        expect(
          (
            await page.request.post(`/api/v1/imports/${id}/rollback`, {
              headers,
              data: { token: preview.token, confirm: true, linked: 'KEEP', confirmLinks: false },
            })
          ).status(),
        ).toBe(201);
      }
    }
    expect(
      evidence
        .map(/** Every source identity must appear exactly once in the actual rendered audit. */ (item) => item.id)
        .sort(),
    ).toEqual([...sourceViews].sort());
    await writeFile(
      `.local/concept-implementation/${info.project.name}-${language}-manifest.json`,
      JSON.stringify(evidence, null, 2),
    );
    await info.attach(`39-view-${language}-geometry`, {
      body: JSON.stringify(evidence, null, 2),
      contentType: 'application/json',
    });
  });
}

test('normal and reduced motion have recordings, stable tiles and usable dialog focus', /** Record actual compositor transitions at the three reference widths and measure all five visual dimensions independently. */ async ({
  browser,
}, info) => {
  const width = info.project.use.viewport!.width;
  test.skip(
    ![390, 768, 1440].includes(width),
    'Recordings use the three reference widths; boundary composition is covered by both 39-view audits.',
  );
  const viewport = { width, height: width === 768 ? 1024 : info.project.use.viewport!.height };
  await mkdir('.local/concept-implementation', { recursive: true });
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    const context = await browser.newContext({
      baseURL: info.project.use.baseURL,
      viewport,
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      colorScheme: 'light',
      reducedMotion,
      recordVideo: { dir: '.local/concept-implementation/video', size: viewport },
    });
    const page = await context.newPage();
    try {
      await page.goto('/login');
      await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
      await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
      await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
      await page.waitForURL(
        /** Establish actual private access before recording settings motion. */ (url) => url.pathname === '/',
      );
      await page.goto('/settings');
      await settle(page);
      const tile = page.locator('.finance-tile--account');
      await tile.scrollIntoViewIfNeeded();
      const before = await tile.boundingBox();
      await tile.hover();
      expect(await tile.boundingBox()).toEqual(before);
      await expect(tile).toHaveCSS('box-shadow', 'none');
      await page.getByRole('button', { name: 'Dunkelmodus', exact: true }).click();
      await verifyContrast(page);
      const trigger = page.getByRole('button', { name: 'Zugang & Datensicherung', exact: true });
      await trigger.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: 'Benutzer- und App-Informationen', exact: true });
      await expect(dialog).toBeVisible();
      const motion = await dialog.evaluate(
        /** Inspect live animation effects and focus ownership without changing them. */ (element) => ({
          focus: element.contains(document.activeElement),
          animations: element.getAnimations().map(
            /** Opacity may change; moving or scaling content is forbidden. */ (animation) => ({
              duration: animation.effect!.getTiming().duration,
              frames: (animation.effect as KeyframeEffect).getKeyframes(),
            }),
          ),
        }),
      );
      expect(motion.focus).toBe(true);
      if (reducedMotion === 'reduce') expect(motion.animations).toEqual([]);
      else {
        expect(motion.animations.length).toBeGreaterThan(0);
        for (const animation of motion.animations) {
          expect(Number(animation.duration)).toBeGreaterThanOrEqual(160);
          expect(Number(animation.duration)).toBeLessThanOrEqual(220);
          expect(
            animation.frames.every(
              /** Avoid translation and scale at every transition frame. */ (frame) => !frame.transform,
            ),
          ).toBe(true);
        }
      }
      await dialog.evaluate(
        /** Settle a real transition through its completion promise. */ async (element) => {
          await Promise.all(
            element
              .getAnimations()
              .map(
                /** No timeout guesses are needed for an actual running animation. */ (animation) => animation.finished,
              ),
          );
        },
      );
      await page.screenshot({ path: `.local/concept-implementation/${info.project.name}-${reducedMotion}-dialog.png` });
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await writeFile(
        `.local/concept-implementation/${info.project.name}-${reducedMotion}-motion.json`,
        JSON.stringify(motion, null, 2),
      );
    } finally {
      await context.close();
      await page.video()!.saveAs(`.local/concept-implementation/${info.project.name}-${reducedMotion}.webm`);
    }
  }
});

test('default dark, high contrast and representative Ayu surfaces remain readable', /** Inspect real overview, analysis, contracts, wealth and settings surfaces in each supported review tone. */ async ({
  page,
}, info) => {
  const width = info.project.use.viewport!.width;
  test.skip(
    ![390, 768, 1440].includes(width),
    'Full theme review uses reference widths; all boundary layouts are audited separately.',
  );
  test.setTimeout(120000);
  if (width === 768) await page.setViewportSize({ width, height: 1024 });
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
  await mkdir('.local/concept-implementation', { recursive: true });
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(/** Keep theme review inside the actual private application. */ (url) => url.pathname === '/');
  for (const [name, mode, tone] of [
    ['Haushaltsbuch', 'Dunkel', 'default-dark'],
    ['Hoher Kontrast', 'Hell', 'contrast-light'],
    ['Hoher Kontrast', 'Dunkel', 'contrast-dark'],
    ['Ayu Light', null, 'ayu-light'],
    ['Ayu Mirage · Ohne Rahmen', null, 'ayu-mirage'],
  ] as const) {
    await page.goto('/settings/appearance');
    await page.getByRole('radio', { name, exact: true }).click();
    if (mode) await choose(page, page.getByLabel('Helligkeit', { exact: true }), mode);
    for (const [path, view] of [
      ['/?month=2026-11', 'overview'],
      ['/analytics?from=2026-07-01&to=2026-10-31', 'analysis'],
      ['/contracts', 'contracts'],
      ['/wealth', 'wealth'],
      ['/settings', 'settings'],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await settle(page);
      await verifyContrast(page);
      await page.screenshot({ path: `.local/concept-implementation/${info.project.name}-${tone}-${view}.png` });
    }
    await page.getByRole('button', { name: 'Zugang & Datensicherung', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `.local/concept-implementation/${info.project.name}-${tone}-dialog.png` });
    await page.keyboard.press('Escape');
  }
});
