import type { Page } from '@playwright/test';
import { test, expect, conceptFixtureLabels } from './fixtures.js';

/** Authenticate the actual disposable owner with the currently rendered language. */
async function login(page: Page, english = false) {
  await page.goto('/login');
  await page.getByLabel(english ? 'Username' : 'Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel(english ? 'Password' : 'Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: english ? 'Sign in' : 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Wait for private route recovery before changing device choices. */ (url) => url.pathname === '/',
  );
}

/** Observe visible and accessible display strings, never request bodies, passwords or bank credentials. */
async function assertMasked(page: Page) {
  const snapshot = await page.locator('body').ariaSnapshot();
  expect(snapshot).not.toMatch(/(?:€\s*[−\-+]?\d|\d[\d.,]*\s*€)/);
  await expect(page.locator('.demo-history-chart, .overview-category-track, [role="progressbar"]')).toHaveCount(0);
  const attributes = await page
    .locator('[title], [aria-label], [aria-description]')
    .evaluateAll(
      /** CSS-hidden text is insufficient: inspect value-bearing accessible attributes directly. */ (elements) =>
        elements.flatMap(
          /** Keep only labels exposed by the rendered controls and charts. */ (element) =>
            ['title', 'aria-label', 'aria-description'].map(
              /** Do not read data attributes, financial sources or input drafts. */ (name) =>
                element.getAttribute(name) ?? '',
            ),
        ),
    );
  expect(attributes.join('\n')).not.toMatch(/(?:€\s*[−\-+]?\d|\d[\d.,]*\s*€)/);
}

test('English device language covers destinations and exact large amounts without changing sources', /** Real navigation and reload prove copy, dates, controls and formatting use the same restored language. */ async ({
  page,
}, info) => {
  await login(page);
  const before = await (await page.request.get('/api/v1/transactions?limit=100')).json();
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Sprache', exact: true }).click();
  await page.getByRole('option', { name: 'English', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Settings', exact: true })).toBeVisible();
  await page.goto('/settings/profile');
  await page.getByLabel('Display name', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByLabel('Display name', { exact: true })).toBeFocused();
  await expect(page.getByText(/Too small/)).toBeVisible();
  await page.goto('/accounts/add');
  await page.getByLabel('Name', { exact: true }).fill('Invalid source must stay local');
  await page.getByLabel('IBAN (optional)', { exact: true }).fill('DE00370400440532013000');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('Please enter a valid German IBAN.', { exact: true })).toBeVisible();
  for (const [path, heading] of [
    ['/settings/profile', 'My profile'],
    ['/settings/account-groups', 'Account groups'],
    ['/settings/password', 'Change password'],
    ['/settings/appearance', 'Appearance'],
    ['/settings/appearance/custom', 'Custom colours'],
    ['/analytics?months=3', 'Analyses'],
    ['/contracts/calendar?month=2026-11', 'Contract calendar'],
    ['/contracts/analysis', 'Contract analysis'],
    ['/contracts', 'Contracts'],
    ['/categories', 'Categories & reports'],
    ['/transactions', 'Your transactions'],
    ['/accounts', 'Your accounts'],
    ['/accounts/add', 'Add account'],
    ['/imports', 'Import history'],
    ['/imports/csv', 'Import CSV'],
    ['/connections', 'Bank connections'],
    ['/notifications', 'Notifications'],
    ['/wealth', 'Wealth'],
    ['/wealth/demo/plans', 'Demo savings plans'],
    ['/wealth/demo/activity', 'Demo activity'],
    ['/more', 'More'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        /** Long English copy must not create horizontal document scrolling. */ () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
  await page.goto('/accounts');
  await expect(page.getByText('€9,007,199,254,740,993.01', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/10\/11\/2026, 13:00/).first()).toBeVisible();
  await expect(page.getByText(conceptFixtureLabels.checking, { exact: true }).first()).toBeVisible();
  expect(await (await page.request.get('/api/v1/transactions?limit=100')).json()).toEqual(before);
  await page.screenshot({ path: `.local/concept-english-accounts-${info.project.name}.png`, fullPage: true });
});

test('early masking removes financial text and chart accessibility across real and demo destinations', /** Observe every mutation from initial document creation; a later CSS overlay cannot hide a leaked first render. */ async ({
  page,
}, info) => {
  await page.addInitScript(
    /** Seed only validated device choices before the real inline bootstrap. */ () => {
      localStorage.setItem(
        'haushaltsbuch-workspace-v1',
        JSON.stringify({ version: 1, language: 'en', maskAmounts: true }),
      );
      const exposed: string[] = [];
      Object.defineProperty(window, '__financialFlash', { value: exposed });
      new MutationObserver(
        /** Record only unexpected synthetic formatted values, not input/session contents. */ () => {
          if (document.body && /(?:€\s*[−\-+]?\d|\d[\d.,]*\s*€)/.test(document.body.innerText))
            exposed.push('formatted amount rendered');
        },
      ).observe(document, { childList: true, subtree: true, characterData: true });
    },
  );
  await login(page, true);
  const before = await (await page.request.get('/api/v1/transactions?limit=100')).json();
  for (const path of [
    '/?month=2026-10',
    '/accounts',
    '/transactions',
    '/analytics?from=2026-07-01&to=2026-10-31',
    '/contracts',
    '/contracts/analysis',
    '/contracts/calendar?month=2026-11',
    '/wealth',
    '/wealth/demo/plans',
    '/wealth/demo/activity',
    '/notifications',
  ]) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-amounts-masked', 'true');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /^Loading/ })).toHaveCount(0);
    await assertMasked(page);
    expect(
      await page.evaluate(
        /** Inspect the first-render observer without reading source amounts. */ () =>
          (window as unknown as { __financialFlash: string[] }).__financialFlash,
      ),
    ).toEqual([]);
  }
  await page.goto('/wealth');
  await expect(page.getByText('Amount hidden', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Record values', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Record values', exact: true })).toBeVisible();
  await assertMasked(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit reserve target', exact: true }).click();
  await expect(page.getByLabel('Reserve target in euros', { exact: true })).toHaveAttribute('type', 'password');
  await assertMasked(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Simulate buy / sell', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await assertMasked(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(
    /** Settle the capture at the page top after dialog focus restoration scrolled to its trigger. */ () =>
      window.scrollTo(0, 0),
  );
  await page.screenshot({ path: `.local/concept-masked-wealth-${info.project.name}.png`, fullPage: true });
  const stored = await page.evaluate(
    /** Device preferences must contain choices, never real cent strings or financial records. */ () =>
      JSON.parse(localStorage.getItem('haushaltsbuch-workspace-v1')!),
  );
  expect(stored).toMatchObject({ version: 1, language: 'en', maskAmounts: true });
  expect(Object.keys(stored).sort()).toEqual(['language', 'maskAmounts', 'version']);
  expect(await (await page.request.get('/api/v1/transactions?limit=100')).json()).toEqual(before);
});
