import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { accountSchema, contractSummarySchema } from '../../packages/contracts/src/index.js';

test('concept parity interactions and rendered review captures', async ({ page }, info) => {
  test.setTimeout(120000);
  const width = info.project.use.viewport!.width;
  const colorScheme = process.env.FEATURE_PARITY_SCHEME === 'light' ? 'light' : 'dark';
  await page.clock.setFixedTime(new Date('2026-11-21T12:00:00Z'));
  if (width === 768) await page.setViewportSize({ width, height: 1024 });
  await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL((url) => url.pathname === '/');
  const session = await (await page.request.get('/api/v1/auth/session')).json();
  const headers = { origin: new URL(page.url()).origin, 'x-csrf-token': session.csrfToken };
  const accounts = accountSchema.array().parse(await (await page.request.get('/api/v1/accounts')).json());
  const plan = contractSummarySchema.parse(await (await page.request.get('/api/v1/contracts/summary')).json());
  for (const [index, name] of ['Tägliche Konten', 'Sparkonten', 'Gemeinsame Konten'].entries()) {
    const group = await page.request.post('/api/v1/account-groups', {
      headers,
      data: { name, accountIds: [accounts[index]!.id] },
    });
    expect(group.status()).toBe(201);
  }
  const contract = await page.request.post('/api/v1/contracts', {
    headers,
    data: {
      name: 'Beispiel · Geplante Einnahme',
      provider: 'Synthetischer Vertragspartner',
      kind: 'OTHER',
      startDate: plan.asOf,
      amountCents: '375000',
      intervalMonths: 3,
      direction: 'INCOME',
    },
  });
  expect(contract.status()).toBe(201);
  await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${colorScheme}\\b`));
  const captureDirectory =
    process.env.FEATURE_PARITY_OUTPUT ??
    (colorScheme === 'light' ? '.local/concept-parity-light' : '.local/concept-parity');
  await mkdir(captureDirectory, { recursive: true });
  const capture = async (view: string) => {
    if (!view.endsWith('-dialog')) await page.evaluate(() => scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await page.screenshot({
      path: `${captureDirectory}/${width}-app-${view}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  };
  async function closeDialog() {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.goto('/?month=2026-11');
  await expect(page.locator('[data-overview-section="bookings"]')).toBeVisible();
  if (width <= 700) {
    const month = await page.locator('.finance-month-controls').boundingBox();
    expect(month).not.toBeNull();
    expect(Math.abs(month!.x + month!.width / 2 - width / 2)).toBeLessThan(9);
  }
  expect(
    await page.locator('[data-overview-section="bookings"] a[href^="/transactions/"]').count(),
  ).toBeLessThanOrEqual(5);
  await expect(
    page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Vermögen' }),
  ).toBeVisible();
  expect(
    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .evaluate((nav) => nav.scrollWidth <= nav.clientWidth),
  ).toBe(true);
  await capture('overview');
  const profile = page.getByRole('button', { name: 'Accountverwaltung', exact: true });
  await profile.click();
  await expect(page.getByRole('dialog').getByRole('link', { name: 'Benachrichtigungen' })).toBeVisible();
  await capture('profile-dialog');
  await closeDialog();
  await expect(profile).toBeFocused();
  await page.getByRole('button', { name: 'Kontogruppen wählen' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Alle Konten' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Sparkonten' })).toBeVisible();
  await capture('group-dialog');
  await closeDialog();
  await page.goto('/transactions');
  await expect(page.locator('.finance-booking-day').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Monat', exact: true })).toHaveText('November 2026');
  expect(
    (await page.locator('.finance-booking-day h3').allTextContents()).every((date) => date.includes('November 2026')),
  ).toBe(true);
  await capture('transactions');
  await page.getByRole('button', { name: 'Vorheriger Monat' }).click();
  await expect(page).toHaveURL(/from=2026-10-01/);
  await page.goto('/transactions?from=2026-10-05&to=2026-11-09');
  await expect(page.getByRole('button', { name: 'Monat', exact: true })).toHaveText('Eigener Zeitraum');
  await page.goto('/transactions?period=all');
  await expect(page.getByRole('button', { name: 'Monat', exact: true })).toHaveText('Alle Monate');
  await expect(page.locator('.finance-booking-day h3').filter({ hasText: 'Oktober 2026' }).first()).toBeVisible();
  await page.goto('/accounts');
  await expect(page.locator('[data-account-card]').first()).toBeVisible();
  await expect(page.locator('.finance-account-summary .finance-tile')).toHaveCount(3);
  await capture('accounts');
  await page.goto('/analytics?from=2026-07-01&to=2026-10-31');
  await expect(page.locator('.finance-month-badge')).toBeVisible();
  await expect(page.locator('.finance-full-analysis')).not.toHaveAttribute('open', '');
  const category = page.locator('[data-analysis-module="categories"]').getByRole('button');
  await expect(category.locator('.mini-finance-ring')).toBeVisible();
  if (width > 700) {
    const tile = category.locator('..');
    await category.scrollIntoViewIfNeeded();
    const position = () =>
      tile.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height };
      });
    const before = await position();
    await category.hover();
    await expect(tile.locator('.finance-tile__graphic')).toHaveCSS('filter', 'brightness(1.12)');
    expect(await position()).toEqual(before);
    await page.mouse.move(0, 0);
  }
  await capture('analytics');
  const before = page.url();
  await category.click();
  await expect(page.getByRole('dialog', { name: 'Ausgaben nach Kategorien' })).toBeVisible();
  await expect(page).toHaveURL(before);
  await capture('analytics-dialog');
  await closeDialog();
  await expect(category).toBeFocused();
  await page.goto('/contracts');
  await expect(page.getByText('Geplant übrig', { exact: true })).toBeVisible();
  const summaries = page.locator('.finance-contract-summary .finance-tile');
  const y = await summaries.evaluateAll((tiles) => tiles.map((tile) => tile.getBoundingClientRect().top));
  expect(new Set(y).size).toBe(width >= 701 ? 1 : 3);
  await expect(page.getByRole('region', { name: 'Einnahmen / Monat', exact: true })).toContainText('1.250,00');
  const direction = page.getByRole('group', { name: 'Zahlungsrichtung', exact: true });
  await expect(page.getByRole('link', { name: /Beispiel · Geplante Einnahme/ })).toHaveCount(0);
  await direction.getByRole('button', { name: 'Einnahmen', exact: true }).click();
  await expect(page.getByRole('link', { name: /Beispiel · Geplante Einnahme/ })).toBeVisible();
  await direction.getByRole('button', { name: 'Alle', exact: true }).click();
  await capture('contracts');
  await page.getByRole('button', { name: 'Vertragskalender' }).click();
  await expect(page.getByRole('dialog', { name: 'Vertragskalender' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nicht monatlich' })).toBeVisible();
  await expect(page.getByText('Vertragskalender wird geladen …')).toHaveCount(0);
  await expect(
    page
      .getByRole('dialog')
      .getByRole('link', { name: /Beispiel · Geplante Einnahme/ })
      .first(),
  ).toBeVisible();
  await capture('calendar-dialog');
  await closeDialog();
  await page.goto('/more');
  await expect(page.getByRole('navigation', { name: 'Mein Geld' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Verwalten' })).toBeVisible();
  await capture('more');
  const mode = page.getByRole('button', { name: 'Dunkelmodus', exact: true });
  await mode.click();
  await expect(page.locator('html')).not.toHaveClass(/theme-reveal/);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mode.click();
  await expect(page.locator('html')).toHaveClass(/theme-reveal/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .getAnimations()
          .some(
            (animation) =>
              (animation.effect as KeyframeEffect | null)?.pseudoElement === '::view-transition-new(root)' &&
              animation.effect?.getTiming().duration === 1700,
          ),
      ),
    )
    .toBe(true);
  await expect(page.locator('html')).not.toHaveClass(/theme-reveal/);
});
