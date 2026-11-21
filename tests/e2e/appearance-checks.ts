import { expect, type Page } from '@playwright/test';

/** Measure resolved browser colors rather than accepting catalog strings as rendered contrast proof. */
export async function verifyContrast(page: Page) {
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
