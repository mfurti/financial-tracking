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

describe('device-local theme families', /** Color choices must remain readable and restore safely before mounting. */ () => {
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
