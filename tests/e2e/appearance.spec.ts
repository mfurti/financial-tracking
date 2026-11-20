import { choose } from './controls.js';
import { test, expect } from './fixtures.js';
import { appearanceChoices, appearanceThemes, choiceTone } from '../../apps/web/app/utils/appearance.js';
import type { Page } from '@playwright/test';

/** Measure resolved browser colors rather than accepting catalog strings as rendered contrast proof. */
async function verifyContrast(page: Page) {
  const measurements = await page.evaluate(
    /** Resolve color-mix and inherited CSS using the browser compositor. */ () => {
      const probe = document.createElement('span');
      document.body.append(probe);
      /** Resolve an opaque semantic token into its rendered sRGB channels. */
      function color(token: string) {
        probe.style.color = `var(${token})`;
        const channels = getComputedStyle(probe)
          .color.match(/[\d.]+/g)!
          .map(Number);
        return getComputedStyle(probe).color.startsWith('color(srgb')
          ? channels.map(/** Normalize modern sRGB serialization. */ (value) => value * 255)
          : channels;
      }
      /** Measure WCAG luminance after resolving the actual CSS color. */
      function luminance(token: string) {
        const values = color(token)
          .slice(0, 3)
          .map(
            /** Linearize each display channel. */ (channel) => {
              const value = channel / 255;
              return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
            },
          );
        return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
      }
      const rows: { key: string; ratio: number; minimum: number }[] = [];
      for (const background of ['--canvas', '--surface', '--soft']) {
        for (const key of [
          '--ink',
          '--muted',
          '--green',
          '--positive',
          '--negative',
          '--focus',
          '--control-border',
          '--chart-1',
          '--chart-2',
          '--chart-3',
          '--chart-4',
          '--chart-5',
          '--chart-6',
        ]) {
          const first = luminance(key),
            second = luminance(background);
          rows.push({
            key: `${key}/${background}`,
            ratio: (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05),
            minimum: ['--ink', '--muted', '--green', '--positive', '--negative'].includes(key) ? 4.5 : 3,
          });
        }
      }
      probe.remove();
      return rows;
    },
  );
  for (const row of measurements) expect(row.ratio, row.key).toBeGreaterThanOrEqual(row.minimum);
}

/** Convert opaque catalog swatches to the browser's computed-color representation. */
function rgb(hex: string) {
  return `rgb(${[1, 3, 5].map(/** Parse color bytes, never monetary values. */ (offset) => parseInt(hex.slice(offset, offset + 2), 16)).join(', ')})`;
}

test('theme tiles apply, retain Ayu brightness/borders and restore before reload', /** Exercise real Nuxt UI radios, circle, storage and keyboard behavior. */ async ({
  page,
}, info) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername', { exact: true }).fill('e2e');
  await page.getByLabel('Passwort', { exact: true }).fill('e2e-test-password-only');
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Finanzieller Überblick' })).toBeVisible();
  await page.goto('/settings/appearance');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('radio')).toHaveCount(23);
  for (const choice of appearanceChoices) {
    const tile = page.getByRole('radio', { name: choice.label, exact: true });
    await tile.click();
    await expect(tile).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-theme', choice.family);
    if (choice.ayu) {
      await expect(page.locator('body')).toHaveCSS('background-color', rgb(choiceTone(choice, 'light')[0]));
      await expect(page.locator('html')).toHaveAttribute('data-ayu-border', choice.ayu.bordered ? 'visible' : 'none');
      await verifyContrast(page);
    } else {
      const family = appearanceThemes.find(
        /** Match the exact bundled family. */ (theme) => theme.id === choice.family,
      )!;
      for (const mode of ['light', 'dark'] as const) {
        await choose(page, page.getByLabel('Helligkeit', { exact: true }), mode === 'light' ? 'Hell' : 'Dunkel');
        await expect(page.locator('body')).toHaveCSS('background-color', rgb(family[mode][0]));
        await verifyContrast(page);
      }
    }
  }
  await page.getByRole('radio', { name: 'Ayu Mirage · Ohne Rahmen', exact: true }).click();
  const toggle = page.getByRole('button', { name: 'Dunkelmodus', exact: true });
  await toggle.click();
  await expect(page.getByRole('radio', { name: 'Ayu Light · Ohne Rahmen', exact: true })).toBeChecked();
  await expect(page.locator('html')).not.toHaveClass(/theme-transition/);
  await toggle.click();
  await expect(page.getByRole('radio', { name: 'Ayu Mirage · Ohne Rahmen', exact: true })).toBeChecked();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-ayu-tone', 'mirage');
  await expect(page.getByRole('radio', { name: 'Ayu Mirage · Ohne Rahmen', exact: true })).toBeChecked();
  await expect(page.locator('.panel').first()).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
  const dracula = page.getByRole('radio', { name: 'Dracula', exact: true });
  await dracula.click();
  await dracula.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: 'Nord', exact: true })).toBeFocused();
  await expect(page.getByRole('radio', { name: 'Nord', exact: true })).toHaveCSS('outline-style', 'solid');
  await expect(page.getByRole('radio', { name: 'Nord', exact: true })).toHaveCSS('outline-offset', '3px');
  await page.keyboard.press('Space');
  await expect(page.getByRole('radio', { name: 'Nord', exact: true })).toBeChecked();
  await dracula.click();
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        /** Detect inaccessible horizontal content at the agreed breakpoints. */ () =>
          document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({ path: `.local/settings-tiles-${info.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
  await expect(page).toHaveURL(/login$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dracula');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});
