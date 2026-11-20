import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import {
  appearanceThemes,
  appearanceVariables,
  appearanceBootstrap,
  resolveAppearanceTheme,
  appearanceChoices,
  choiceTone,
  ayuMirage,
  resolveAyuPreference,
  ayuStorageKey,
  defaultCustomAppearance,
  resolveCustomAppearance,
  customAppearanceStyleSheet,
} from '../apps/web/app/utils/appearance.js';

/** Calculate the WCAG relative luminance of a bundled opaque sRGB color. */
function luminance(hex: string) {
  const values = [1, 3, 5].map(
    /** Linearize each sRGB channel before applying perceptual weights. */ (offset) => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    },
  );
  return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
}
/** Measure actual palette contrast, independent of CSS token serialization. */
function contrast(first: string, second: string) {
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Resolve the catalog's opaque sRGB mixtures before checking visible layer contrast. */
function composite(value: string): string {
  const mix = /^color-mix\(in srgb, (#[0-9a-f]{6}) (\d+)%, (#[0-9a-f]{6})\)$/.exec(value);
  if (!mix) return value;
  const weight = Number(mix[2]) / 100;
  return `#${[1, 3, 5]
    .map(
      /** Blend display channels, never financial amounts. */ (offset) =>
        Math.round(
          parseInt(mix[1]!.slice(offset, offset + 2), 16) * weight +
            parseInt(mix[3]!.slice(offset, offset + 2), 16) * (1 - weight),
        )
          .toString(16)
          .padStart(2, '0'),
    )
    .join('')}`;
}

describe('device-local theme families', /** Color choices must remain readable and restore safely before mounting. */ () => {
  it('keeps composited surfaces, chart keys and essential controls readable for every choice', /** Distinguish decorative dividers from required control and focus indicators. */ () => {
    for (const choice of appearanceChoices) {
      for (const mode of ['light', 'dark'] as const) {
        const tone = choiceTone(choice, mode);
        const tokens = appearanceVariables(
          { id: choice.family, name: choice.label, light: tone, dark: tone },
          choice.mode ?? mode,
        );
        for (const background of [tone[0], tone[1], composite(tokens['--soft']!)]) {
          for (const key of ['--ink', '--muted', '--green', '--positive', '--negative'])
            expect(contrast(tokens[key]!, background), `${choice.value}/${mode}/${key}`).toBeGreaterThanOrEqual(4.5);
          for (const key of [
            '--control-border',
            '--focus',
            ...Array.from(
              { length: 6 },
              /** Require every selectable diagram key to remain visible. */ (_, index) => `--chart-${index + 1}`,
            ),
          ])
            expect(
              contrast(composite(tokens[key]!), background),
              `${choice.value}/${mode}/${key}`,
            ).toBeGreaterThanOrEqual(3);
        }
        expect(tokens['--line']).toBeDefined();
      }
    }
  });
  it('offers six readable Ayu variants without invalidating legacy identities', /** Verify actual variant tones and allowlisted persistence, including corrupt values. */ () => {
    expect(appearanceChoices).toHaveLength(23);
    const variants = appearanceChoices.filter(
      /** Inspect the six explicit choices. */ (choice) => choice.family === 'ayu',
    );
    expect(variants).toHaveLength(6);
    expect(
      new Set(appearanceChoices.map(/** Every radio requires a unique value. */ (choice) => choice.value)).size,
    ).toBe(23);
    for (const choice of variants) {
      const [canvas, surface, ink, muted, accent, onAccent] = choiceTone(choice, 'light');
      for (const background of [canvas, surface]) {
        expect(contrast(ink, background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(muted, background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(accent, background)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(onAccent, accent)).toBeGreaterThanOrEqual(4.5);
    }
    expect(
      choiceTone(
        variants.find(/** Mirage must not silently use Dark. */ (choice) => choice.value === 'ayu-mirage')!,
        'light',
      ),
    ).toEqual(ayuMirage);
    expect(resolveAppearanceTheme('ayu').id).toBe('ayu');
    expect(resolveAyuPreference({ tone: 'invalid', bordered: 'false' })).toEqual({ tone: 'dark', bordered: true });
    for (const stored of [null, '{broken', JSON.stringify({ tone: 'mirage', bordered: false })]) {
      const dataset: Record<string, string> = {};
      runInNewContext(appearanceBootstrap(), {
        document: { documentElement: { dataset } },
        localStorage: {
          getItem: /** Restore independent family and variant keys before mount. */ (key: string) =>
            key === ayuStorageKey ? stored : 'ayu',
        },
      });
      expect(dataset.theme).toBe('ayu');
      expect(dataset.ayuTone).toBe(stored?.startsWith('{"') ? 'mirage' : 'dark');
      expect(dataset.ayuBorder).toBe(stored?.startsWith('{"') ? 'none' : 'visible');
    }
  });
  it.each(appearanceThemes)(
    '$name has readable light and dark text/actions',
    /** Check all bundled families, not just the visually inspected default. */ (theme) => {
      for (const mode of ['light', 'dark'] as const) {
        const [canvas, surface, ink, muted, accent, onAccent] = theme[mode];
        for (const background of [canvas, surface]) {
          expect(contrast(ink, background), `${theme.id}/${mode}/text`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(muted, background), `${theme.id}/${mode}/secondary`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(accent, background), `${theme.id}/${mode}/action`).toBeGreaterThanOrEqual(4.5);
          const tokens = appearanceVariables(theme, mode);
          expect(contrast(tokens['--positive']!, background), `${theme.id}/${mode}/income`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(tokens['--negative']!, background), `${theme.id}/${mode}/expense`).toBeGreaterThanOrEqual(
            4.5,
          );
        }
        expect(contrast(onAccent, accent), `${theme.id}/${mode}/button`).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
  it('restores allowlisted choices before mount and survives invalid or blocked storage', /** Execute the actual emitted early script with controlled browser primitives. */ () => {
    expect(appearanceThemes).toHaveLength(18);
    expect(new Set(appearanceThemes.map(/** Prevent duplicate option values. */ (theme) => theme.id)).size).toBe(18);
    for (const value of ['dracula', 'not-a-theme', '"><script>bad</script>', null, 'blocked']) {
      const dataset: Record<string, string> = {};
      runInNewContext(appearanceBootstrap(), {
        document: { documentElement: { dataset } },
        localStorage: {
          getItem: /** Simulate private-mode storage denial as well as normal preferences. */ () => {
            if (value === 'blocked') throw Error('Storage denied');
            return value;
          },
        },
      });
      expect(dataset.theme).toBe(value === 'dracula' ? 'dracula' : 'default');
    }
    expect(resolveAppearanceTheme({ id: 'dracula' }).id).toBe('default');
  });
});

describe('validated paired custom appearance', /** User colors must preserve all actual semantic contrast and safe early restoration. */ () => {
  it('accepts fresh paired hex tones while preserving readable text, controls and exact token ownership', /** Both modes are validated together; fixed financial colors remain independent of the custom accent. */ () => {
    const pair = defaultCustomAppearance();
    expect(resolveCustomAppearance(pair)).toEqual(pair);
    const css = customAppearanceStyleSheet(pair);
    expect(css).toContain('html[data-theme="custom"]');
    expect(css).toContain('html.dark[data-theme="custom"]');
    expect(css).toContain('--canvas:#f6f6fc');
    expect(css).toContain('--positive:#137453');
    expect(resolveAppearanceTheme('custom', pair).id).toBe('custom');
    expect(resolveAppearanceTheme('custom', {}).id).toBe('default');
    const upper = {
      light: pair.light.map(
        /** Canonicalize display-only hex case after validating its shape. */ (color) => color.toUpperCase(),
      ),
      dark: [...pair.dark],
    };
    expect(resolveCustomAppearance(upper)).toEqual(pair);
  });
  it('rejects bad shape, CSS/alpha injection and low-contrast text/actions without changing the supplied pair', /** Invalid replacement cannot become an interpolated stylesheet. */ () => {
    const pair = defaultCustomAppearance(),
      before = JSON.stringify(pair);
    const bad = [
      null,
      {},
      { ...pair, amountCents: '12345' },
      { light: pair.light, dark: [] },
      { ...pair, light: ['#ffffff;display:none', ...pair.light.slice(1)] },
      { ...pair, light: ['#ffffff00', ...pair.light.slice(1)] },
      { ...pair, light: [pair.light[0], pair.light[1], pair.light[0], ...pair.light.slice(3)] },
      { ...pair, dark: [...pair.dark.slice(0, 4), pair.dark[0], pair.dark[5]] },
    ];
    for (const value of bad) {
      expect(resolveCustomAppearance(value)).toBeNull();
      expect(customAppearanceStyleSheet(value)).toBe('');
    }
    expect(JSON.stringify(pair)).toBe(before);
  });
  it('executes the real early custom bootstrap without application code and fails closed for invalid/future storage', /** Restored paired CSS must already exist before the Vue plugin can conceal a broken bootstrap. */ () => {
    for (const version of [1, 9]) {
      const dataset: Record<string, string> = {},
        styles: { id: string; textContent: string }[] = [];
      const saved = JSON.stringify({ version, custom: defaultCustomAppearance() });
      runInNewContext(appearanceBootstrap(), {
        document: {
          documentElement: { dataset },
          createElement: /** Provide only the real early style boundary. */ () => ({ id: '', textContent: '' }),
          head: {
            appendChild: /** Capture exact CSS before any application mount. */ (style: {
              id: string;
              textContent: string;
            }) => {
              styles.push(style);
            },
          },
        },
        localStorage: {
          getItem: /** Keep palette and workspace keys independent. */ (key: string) =>
            key === 'haushaltsbuch-palette' ? 'custom' : key === 'haushaltsbuch-workspace-v1' ? saved : null,
        },
      });
      expect(dataset.theme).toBe(version === 1 ? 'custom' : 'default');
      expect(styles).toHaveLength(version === 1 ? 1 : 0);
      if (version === 1) expect(styles[0]!.textContent).toBe(customAppearanceStyleSheet(defaultCustomAppearance()));
    }
  });
});
