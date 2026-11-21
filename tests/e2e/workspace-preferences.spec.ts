import { test, expect } from './fixtures.js';

test('device locale and display masking restore early without replacing the chosen palette', /** Exercise the real head bootstrap, client plugin and an authenticated amount surface. */ async ({
  page,
}) => {
  await page.addInitScript(
    /** Seed only the dedicated synthetic device choices; preserve the same stored values on reload. */ () => {
      if (!localStorage.getItem('haushaltsbuch-workspace-v1')) {
        localStorage.setItem(
          'haushaltsbuch-workspace-v1',
          JSON.stringify({ version: 1, language: 'en', maskAmounts: true, analysisModules: ['months'] }),
        );
        localStorage.setItem('haushaltsbuch-palette', 'dracula');
      }
    },
  );
  await page.goto('/login');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-amounts-masked', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');
  await page.locator('input[autocomplete="username"]').fill('e2e');
  await page.locator('input[type="password"]').fill('e2e-test-password-only');
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/** Inspect only the completed authenticated screen. */ (url) => url.pathname === '/');
  await expect(page.locator('.finance-overview-stats [data-financial]').first()).toBeVisible();
  await expect(page.locator('.finance-overview-stats [data-financial]').first()).toHaveCSS('color', 'rgba(0, 0, 0, 0)');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-amounts-masked', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');
});

test('blocked device storage keeps login usable with default locale and privacy', /** A throwing browser storage getter must not abort the shared appearance/preference plugin. */ async ({
  page,
}) => {
  await page.addInitScript(
    /** Deny storage at its getter boundary, including consumers that evaluate the property before reading a key. */ () => {
      Object.defineProperty(globalThis, 'localStorage', {
        get: /** Simulate a browser privacy policy. */ () => {
          throw new Error('storage blocked');
        },
      });
    },
  );
  await page.goto('/login');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.locator('html')).toHaveAttribute('data-amounts-masked', 'false');
  await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
  await expect(page.locator('form button[type="submit"]')).toBeEnabled();
});
