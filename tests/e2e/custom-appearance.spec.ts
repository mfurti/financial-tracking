import { test, expect } from './fixtures.js';
import { verifyContrast } from './appearance-checks.js';

test.use({ colorScheme: 'light' });

test('paired custom colors reject invalid replacement and restore before application scripts', /** Real compositor contrast, keyboard focus and gated-script reload prove a working paired palette without a plugin-hidden flash. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(
    /** Finish session recovery before editing device-only appearance. */ (url) => url.pathname === '/',
  );
  await page.goto('/settings/appearance');
  await page.getByRole('link', { name: 'Eigene Farben bearbeiten', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Eigene Farben', exact: true })).toBeVisible();
  const original = await page.evaluate(
    /** Observe only device appearance state, never real financial values. */ () => ({
      palette: localStorage.getItem('haushaltsbuch-palette'),
      preferences: localStorage.getItem('haushaltsbuch-workspace-v1'),
    }),
  );
  await page.getByLabel('Helle Darstellung: Hintergrund', { exact: true }).fill('#oops');
  await page.getByRole('button', { name: 'Eigene Farben übernehmen', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Hex-Farbe');
  await expect(page.getByLabel('Helle Darstellung: Hintergrund', { exact: true })).toBeFocused();
  await page.getByLabel('Helle Darstellung: Hintergrund', { exact: true }).fill('#f6f6fc');
  await page.getByLabel('Helle Darstellung: Text', { exact: true }).fill('#f6f6fc');
  await page.getByRole('button', { name: 'Eigene Farben übernehmen', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Kontrast');
  await expect(page.getByLabel('Helle Darstellung: Text', { exact: true })).toBeFocused();
  expect(
    await page.evaluate(
      /** Neither malformed nor unreadable drafts may replace working persisted choices. */ () => ({
        palette: localStorage.getItem('haushaltsbuch-palette'),
        preferences: localStorage.getItem('haushaltsbuch-workspace-v1'),
      }),
    ),
  ).toEqual(original);
  await page.getByLabel('Helle Darstellung: Text', { exact: true }).fill('#1c1d2e');
  await page.getByLabel('Helle Darstellung: Akzent', { exact: true }).fill('#3b238f');
  await page.getByLabel('Dunkle Darstellung: Akzent', { exact: true }).fill('#c1c7ff');
  await page.getByRole('button', { name: 'Eigene Farben übernehmen', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Eigene Farben für Hell und Dunkel übernommen.');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'custom');
  await verifyContrast(page);
  await page.getByRole('button', { name: 'Dunkelmodus', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await verifyContrast(page);
  const stored = await page.evaluate(
    /** Persisted custom payload contains only paired display tones. */ () =>
      JSON.parse(localStorage.getItem('haushaltsbuch-workspace-v1')!).custom,
  );
  expect(Object.keys(stored).sort()).toEqual(['dark', 'light']);
  let release!: () => void;
  const gate = new Promise<void>(
    /** Hold every application module until the actual inline bootstrap has restored CSS. */ (resolve) => {
      release = resolve;
    },
  );
  await page.route(
    '**/_nuxt/*.js',
    /** Delay module execution without replacing any source or stylesheet. */ async (route) => {
      await gate;
      await route.continue();
    },
  );
  try {
    await page.goto('/settings/appearance/custom', { waitUntil: 'commit' });
    await expect
      .poll(
        /** This assertion must pass while Vue/application modules are still blocked. */ () =>
          page.evaluate(
            /** Inspect only early restored theme/owned stylesheet state. */ () => ({
              theme: document.documentElement.dataset.theme,
              style: Boolean(
                document.getElementById('haushaltsbuch-custom-palette')?.textContent?.includes('--green:#c1c7ff'),
              ),
            }),
          ),
      )
      .toEqual({ theme: 'custom', style: true });
  } finally {
    release();
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Eigene Farben', exact: true })).toBeVisible();
  await page.unroute('**/_nuxt/*.js');
  await expect(page.getByLabel('Dunkle Darstellung: Akzent', { exact: true })).toHaveValue('#c1c7ff');
  await expect(page.locator('#haushaltsbuch-custom-palette')).toHaveCount(1);
  await verifyContrast(page);
  await page.getByRole('link', { name: 'Zurück zu Darstellung', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Eigene Farben', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Nord', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'nord');
  await page.getByRole('radio', { name: 'Eigene Farben', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'custom');
  expect(
    await page.evaluate(
      /** Preset selection never deletes the validated saved custom pair. */ () =>
        JSON.parse(localStorage.getItem('haushaltsbuch-workspace-v1')!).custom,
    ),
  ).toEqual(stored);
  expect(
    await page.evaluate(
      /** Paired controls and long contrast guidance stay inside all selected viewports. */ () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.getByRole('link', { name: 'Eigene Farben bearbeiten', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Eigene Farben', exact: true })).toBeVisible();
  await page.evaluate(
    /** Capture the editor from its settled top position after restoring the saved pair. */ () => window.scrollTo(0, 0),
  );
  await page.screenshot({ path: `.local/concept-custom-appearance-${info.project.name}.png`, fullPage: true });
});

test('blocked custom persistence keeps the session usable and the previous stored family intact', /** A quota failure cannot replace the last durable working theme with an unpersisted custom identity. */ async ({
  page,
}) => {
  await page.addInitScript(
    /** Deny only paired workspace persistence while keeping ordinary theme and session behavior available. */ () => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = /** Simulate an atomic quota failure, not an invented successful save. */ function (
        key,
        value,
      ) {
        if (key === 'haushaltsbuch-workspace-v1') throw new DOMException('quota', 'QuotaExceededError');
        return set.call(this, key, value);
      };
    },
  );
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await page.waitForURL(/** Finish the real session before blocked device settings. */ (url) => url.pathname === '/');
  await page.goto('/settings/appearance');
  await page.getByRole('radio', { name: 'Nord', exact: true }).click();
  await page.getByRole('link', { name: 'Eigene Farben bearbeiten', exact: true }).click();
  await page.getByRole('button', { name: 'Eigene Farben übernehmen', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'custom');
  await expect(
    page.getByText(
      'Gerätespeicher nicht verfügbar oder ungültig. Farben bleiben gegebenenfalls nur für diese Sitzung erhalten.',
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      /** Preserve the previous durable family when paired storage failed. */ () =>
        localStorage.getItem('haushaltsbuch-palette'),
    ),
  ).toBe('nord');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'nord');
});
