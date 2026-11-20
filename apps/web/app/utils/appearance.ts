/** App-adapted tone: canvas, card, text, secondary text, primary action and its text. */
export type ThemeTone = readonly [
  canvas: string,
  surface: string,
  ink: string,
  muted: string,
  accent: string,
  onAccent: string,
];
/** A named color family always supports both app modes, even when its editor inspiration is dark-only. */
export type AppearanceTheme = { id: string; name: string; light: ThemeTone; dark: ThemeTone };

export const appearanceStorageKey = 'haushaltsbuch-palette';
export const appearanceThemes = [
  {
    id: 'default',
    name: 'Haushaltsbuch',
    light: ['#f6f7fb', '#ffffff', '#202438', '#60667b', '#6254c7', '#ffffff'],
    dark: ['#13131f', '#1d1d2e', '#f2f0ff', '#b7b4cb', '#a99bf3', '#171322'],
  },
  {
    id: 'vscode',
    name: 'VS Code Modern',
    light: ['#f3f3f3', '#ffffff', '#242424', '#616161', '#0067c0', '#ffffff'],
    dark: ['#1f1f1f', '#252526', '#cccccc', '#b0b0b0', '#6cb6ff', '#101820'],
  },
  {
    id: 'github',
    name: 'GitHub',
    light: ['#f6f8fa', '#ffffff', '#1f2328', '#59636e', '#0969da', '#ffffff'],
    dark: ['#0d1117', '#161b22', '#e6edf3', '#9da7b3', '#58a6ff', '#0d1117'],
  },
  {
    id: 'one-dark',
    name: 'One Dark Pro',
    light: ['#f6f7fa', '#ffffff', '#2d3343', '#586273', '#6d43a8', '#ffffff'],
    dark: ['#21252b', '#282c34', '#abb2bf', '#abafb9', '#61afef', '#18222c'],
  },
  {
    id: 'dracula',
    name: 'Dracula',
    light: ['#fffbea', '#fffdf4', '#1f1f1f', '#6c664b', '#644ac9', '#ffffff'],
    dark: ['#21222c', '#282a36', '#f8f8f2', '#b7b5cf', '#bd93f9', '#282a36'],
  },
  {
    id: 'nord',
    name: 'Nord',
    light: ['#eceff4', '#ffffff', '#2e3440', '#4c566a', '#3b5c7b', '#ffffff'],
    dark: ['#2e3440', '#3b4252', '#eceff4', '#c0c8d5', '#88c0d0', '#202b33'],
  },
  {
    id: 'monokai',
    name: 'Monokai',
    light: ['#f7f7ed', '#fffffa', '#272822', '#626450', '#866719', '#ffffff'],
    dark: ['#20211c', '#272822', '#f8f8f2', '#c7c7b2', '#a6e22e', '#272822'],
  },
  {
    id: 'solarized',
    name: 'Solarized',
    light: ['#fdf6e3', '#fffaf0', '#3d555e', '#586e75', '#006a94', '#ffffff'],
    dark: ['#002b36', '#073642', '#fdf6e3', '#9fb1b3', '#42c5b8', '#002b36'],
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    light: ['#eff1f5', '#ffffff', '#4c4f69', '#61647a', '#8839ef', '#ffffff'],
    dark: ['#181825', '#1e1e2e', '#cdd6f4', '#bac2de', '#cba6f7', '#1e1e2e'],
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    light: ['#e6e7ed', '#f5f6fa', '#343b58', '#525b79', '#34548a', '#ffffff'],
    dark: ['#16161e', '#1a1b26', '#c0caf5', '#a9b1d6', '#7aa2f7', '#1a1b26'],
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    light: ['#fbf1c7', '#fff9e5', '#3c3836', '#665c54', '#8f3f71', '#ffffff'],
    dark: ['#1d2021', '#282828', '#ebdbb2', '#d5c4a1', '#fabd2f', '#282828'],
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    light: ['#fbfbfb', '#ffffff', '#403f53', '#686675', '#5a4988', '#ffffff'],
    dark: ['#011627', '#082237', '#d6deeb', '#b0becf', '#82aaff', '#011627'],
  },
  {
    id: 'material',
    name: 'Material',
    light: ['#fafafa', '#ffffff', '#263238', '#546e7a', '#00796b', '#ffffff'],
    dark: ['#212733', '#263238', '#eeffff', '#b2c7cd', '#80cbc4', '#17292b'],
  },
  {
    id: 'ayu',
    name: 'Ayu',
    light: ['#fafafa', '#ffffff', '#3d4852', '#62696f', '#a15c00', '#ffffff'],
    dark: ['#0b0e14', '#10151f', '#bfbdb6', '#b3b1a9', '#ffcc66', '#151923'],
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    light: ['#faf4ed', '#fffaf3', '#575279', '#686380', '#9c3f57', '#ffffff'],
    dark: ['#191724', '#1f1d2e', '#e0def4', '#b3aecb', '#c4a7e7', '#191724'],
  },
  {
    id: 'cobalt2',
    name: 'Cobalt2',
    light: ['#f0f5fb', '#ffffff', '#193549', '#455d72', '#005b99', '#ffffff'],
    dark: ['#122738', '#193549', '#ffffff', '#a8c6dc', '#ffc600', '#193549'],
  },
  {
    id: 'synthwave',
    name: "SynthWave '84",
    light: ['#faf4fb', '#ffffff', '#39294c', '#6b5578', '#943076', '#ffffff'],
    dark: ['#1b1428', '#262033', '#f8efff', '#d0bbdf', '#ff7edb', '#241b2f'],
  },
  {
    id: 'high-contrast',
    name: 'Hoher Kontrast',
    light: ['#ffffff', '#ffffff', '#000000', '#333333', '#0000a0', '#ffffff'],
    dark: ['#000000', '#000000', '#ffffff', '#e0e0e0', '#ffff00', '#000000'],
  },
] as const satisfies readonly AppearanceTheme[];

/** Known device-local theme identity, never an arbitrary CSS or extension input. */
export type AppearanceThemeId = (typeof appearanceThemes)[number]['id'] | 'custom';
/** A custom family contains validated paired tones, never arbitrary CSS or real account data. */
export type CustomAppearance = { light: ThemeTone; dark: ThemeTone };

/** Remember which dark Ayu tone and panel treatment a device last selected. */
export type AyuPreference = { tone: 'dark' | 'mirage'; bordered: boolean };
export const ayuStorageKey = 'haushaltsbuch-ayu';
export const ayuMirage: ThemeTone = ['#1f2430', '#242936', '#cccac2', '#b2bbcf', '#ffcc66', '#1f2430'];
/** A visible tile can fix Ayu brightness while ordinary families follow the independent mode. */
export type AppearanceChoice = {
  value: string;
  label: string;
  family: AppearanceThemeId;
  mode?: 'light' | 'dark';
  ayu?: AyuPreference;
};
export const appearanceChoices: AppearanceChoice[] = [
  ...appearanceThemes
    .filter(/** Replace the legacy Ayu family with six explicit variants. */ (theme) => theme.id !== 'ayu')
    .map(
      /** Keep every existing family identity valid. */ (theme) => ({
        value: theme.id,
        label: theme.name,
        family: theme.id,
      }),
    ),
  ...(['light', 'dark', 'mirage'] as const).flatMap(
    /** Pair each Ayu tone with its panel treatment. */ (tone) =>
      [true, false].map(
        /** Encode only bundled variants. */ (bordered) => ({
          value: `ayu-${tone}${bordered ? '' : '-borderless'}`,
          label: `Ayu ${tone === 'light' ? 'Light' : tone === 'dark' ? 'Dark' : 'Mirage'}${bordered ? '' : ' · Ohne Rahmen'}`,
          family: 'ayu' as const,
          mode: tone === 'light' ? ('light' as const) : ('dark' as const),
          ayu: { tone: tone === 'mirage' ? ('mirage' as const) : ('dark' as const), bordered },
        }),
      ),
  ),
];

/** Treat corrupt or older storage as the original bordered dark Ayu palette. */
export function resolveAyuPreference(value: unknown): AyuPreference {
  if (!value || typeof value !== 'object') return { tone: 'dark', bordered: true };
  const record = value as Record<string, unknown>;
  return { tone: record.tone === 'mirage' ? 'mirage' : 'dark', bordered: record.bordered !== false };
}

/** Resolve the tile preview to exactly the same bundled tones used by the application. */
export function choiceTone(
  choice: AppearanceChoice,
  mode: 'light' | 'dark',
  custom?: CustomAppearance | null,
): ThemeTone {
  if (choice.family === 'ayu' && choice.mode === 'dark' && choice.ayu?.tone === 'mirage') return ayuMirage;
  return resolveAppearanceTheme(choice.family, custom)[choice.mode ?? mode];
}

/** Invalid or missing stored preferences fall back to the default family. */
export function resolveAppearanceTheme(value: unknown, custom?: unknown) {
  const pair = value === 'custom' ? resolveCustomAppearance(custom) : null;
  if (pair) return { id: 'custom' as const, name: 'Eigene Farben', ...pair };
  return (
    appearanceThemes.find(/** Accept only a bundled family. */ (theme) => theme.id === value) ?? appearanceThemes[0]
  );
}

/** Map an adapted tone to shared page/component tokens, with financial colors independent of branding. */
export function appearanceVariables(theme: AppearanceTheme, mode: 'light' | 'dark'): Record<string, string> {
  const [canvas, surface, ink, muted, accent, onAccent] = theme[mode];
  const contrast = theme.id === 'high-contrast';
  const line = contrast ? (mode === 'dark' ? '#ffffff' : '#000000') : `color-mix(in srgb, ${ink} 14%, ${surface})`;
  const soft = `color-mix(in srgb, ${accent} 3%, ${surface})`;
  return {
    '--canvas': canvas,
    '--surface': surface,
    '--soft': soft,
    '--ink': ink,
    '--muted': muted,
    '--line': line,
    '--control-border': muted,
    '--focus': accent,
    '--green': accent,
    '--on-accent': onAccent,
    '--positive': mode === 'dark' ? '#65d9ae' : '#137453',
    '--negative': mode === 'dark' ? '#ff9fac' : '#ad2945',
    '--accent-soft': soft,
    '--balance': contrast ? '#000000' : `color-mix(in srgb, ${accent} 34%, #151329)`,
    '--on-balance': '#ffffff',
    '--balance-muted': '#dfdef0',
    '--shadow': mode === 'dark' ? '#00000030' : '#25204a0c',
    '--ui-primary': accent,
    '--ui-text-inverted': onAccent,
    '--ui-bg': surface,
    '--ui-bg-muted': soft,
    '--ui-bg-elevated': surface,
    '--ui-text': ink,
    '--ui-text-muted': muted,
    '--ui-text-toned': muted,
    '--ui-text-highlighted': ink,
    '--ui-border': line,
    '--chart-1': accent,
    '--chart-2': mode === 'dark' ? '#62d9c5' : '#08786c',
    '--chart-3': mode === 'dark' ? '#f0be70' : '#956018',
    '--chart-4': mode === 'dark' ? '#f7a5bb' : '#aa4163',
    '--chart-5': mode === 'dark' ? '#9cc5ff' : '#3b68a3',
    '--chart-6': mode === 'dark' ? '#c2b0dc' : '#746087',
  };
}

/** Emit static palette CSS at build time so a restored preference is available before the app mounts. */
export function appearanceStyleSheet() {
  const families = appearanceThemes
    .flatMap(
      /** Give every family both light and dark selectors. */ (theme) =>
        (['light', 'dark'] as const).map(
          /** Serialize only bundled token names and color values. */ (mode) => {
            const values = Object.entries(appearanceVariables(theme, mode))
              .map(/** CSS custom properties carry the semantic palette. */ ([key, value]) => `${key}:${value}`)
              .join(';');
            return `html${mode === 'dark' ? '.dark' : ''}[data-theme="${theme.id}"]{${values}}`;
          },
        ),
    )
    .join('\n');
  const mirage = Object.entries(appearanceVariables({ ...resolveAppearanceTheme('ayu'), dark: ayuMirage }, 'dark'))
    .map(/** Emit the same semantic tokens for the alternate dark tone. */ ([key, value]) => `${key}:${value}`)
    .join(';');
  return `${families}\nhtml.dark[data-theme="ayu"][data-ayu-tone="mirage"]{${mirage}}\nhtml[data-theme="ayu"][data-ayu-border="none"] .panel{border-color:transparent}`;
}

/** Restore only an allowlisted family before first paint; storage denial keeps the default usable. */
export function appearanceBootstrap() {
  const ids = JSON.stringify(
    appearanceThemes.map(/** Stored values cannot introduce new styles. */ (theme) => theme.id),
  );
  return `(()=>{let id='default',tone='dark',border='visible',selected=null;try{selected=localStorage.getItem('${appearanceStorageKey}');if(${ids}.includes(selected))id=selected;const ayu=JSON.parse(localStorage.getItem('${ayuStorageKey}')||'null');if(ayu&&typeof ayu==='object'){if(ayu.tone==='mirage')tone='mirage';if(ayu.bordered===false)border='none';}}catch{}try{const variables=${appearanceVariables.toString()};const validate=${resolveCustomAppearance.toString()};const styles=${customAppearanceStyleSheet.toString()};const saved=JSON.parse(localStorage.getItem('haushaltsbuch-workspace-v1')||'null');const pair=saved&&saved.version===1?validate(saved.custom,variables):null;if(pair){const style=document.createElement('style');style.id='haushaltsbuch-custom-palette';style.textContent=styles(pair,validate,variables);document.head.appendChild(style);if(selected==='custom')id='custom';}}catch{}const d=document.documentElement.dataset;d.theme=id;d.ayuTone=tone;d.ayuBorder=border;})();`;
}

/** Validate paired opaque sRGB tones against actual semantic backgrounds, text, controls and chart marks. */
export function resolveCustomAppearance(
  value: unknown,
  variables: typeof appearanceVariables = appearanceVariables,
): CustomAppearance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || !Object.hasOwn(record, 'light') || !Object.hasOwn(record, 'dark'))
    return null;
  const pair: Partial<CustomAppearance> = {};
  for (const mode of ['light', 'dark'] as const) {
    const tone = record[mode];
    if (
      !Array.isArray(tone) ||
      tone.length !== 6 ||
      !tone.every(
        /** Only full opaque hex colors may become CSS. */ (color) =>
          typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color),
      )
    )
      return null;
    pair[mode] = tone.map(
      /** Canonical serialization excludes every alternate CSS syntax. */ (color: string) => color.toLowerCase(),
    ) as unknown as ThemeTone;
  }
  /** Resolve the exact opaque color-mix expressions emitted by the shared semantic palette. */
  function rgb(color: string): number[] | null {
    if (/^#[0-9a-f]{6}$/i.test(color))
      return [1, 3, 5].map(
        /** Parse display channels, never financial values. */ (offset) =>
          parseInt(color.slice(offset, offset + 2), 16),
      );
    const mix = /^color-mix\(in srgb, (#[0-9a-f]{6}) (\d+)%, (#[0-9a-f]{6})\)$/i.exec(color);
    if (!mix) return null;
    const first = rgb(mix[1]!)!,
      second = rgb(mix[3]!)!,
      weight = Number(mix[2]) / 100;
    return first.map(
      /** Preserve fractional compositor channels until luminance calculation. */ (channel, index) =>
        channel * weight + second[index]! * (1 - weight),
    );
  }
  /** Compute WCAG luminance from resolved opaque sRGB channels. */
  function luminance(color: string): number | null {
    const channels = rgb(color);
    if (!channels) return null;
    const linear = channels.map(
      /** Linearize display colors before measuring readability. */ (channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      },
    );
    return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
  }
  /** Reject unresolvable colors instead of treating an unsupported CSS expression as readable. */
  function ratio(first: string, second: string) {
    const a = luminance(first),
      b = luminance(second);
    return a === null || b === null ? 0 : (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }
  const normalized = pair as CustomAppearance;
  for (const mode of ['light', 'dark'] as const) {
    const palette = variables({ id: 'custom', name: 'Custom', ...normalized }, mode);
    for (const background of ['--canvas', '--surface', '--soft']) {
      for (const foreground of ['--ink', '--muted', '--green', '--positive', '--negative'])
        if (ratio(palette[foreground]!, palette[background]!) < 4.5) return null;
      for (const foreground of [
        '--control-border',
        '--focus',
        '--chart-1',
        '--chart-2',
        '--chart-3',
        '--chart-4',
        '--chart-5',
        '--chart-6',
      ])
        if (ratio(palette[foreground]!, palette[background]!) < 3) return null;
    }
    if (
      ratio(palette['--on-accent']!, palette['--green']!) < 4.5 ||
      ratio(palette['--on-balance']!, palette['--balance']!) < 4.5 ||
      ratio(palette['--balance-muted']!, palette['--balance']!) < 4.5
    )
      return null;
  }
  return normalized;
}

/** Emit only validated semantic property names and paired colors; stored CSS syntax is never interpolated. */
export function customAppearanceStyleSheet(
  value: unknown,
  validate: typeof resolveCustomAppearance = resolveCustomAppearance,
  variables: typeof appearanceVariables = appearanceVariables,
) {
  const pair = validate(value, variables);
  if (!pair) return '';
  return (['light', 'dark'] as const)
    .map(
      /** Both brightness modes are available before and after a circle toggle. */ (mode) =>
        `html${mode === 'dark' ? '.dark' : ''}[data-theme="custom"]{${Object.entries(
          variables({ id: 'custom', name: 'Custom', ...pair }, mode),
        )
          .map(
            /** Serialize trusted token names and validated derived colors only. */ ([key, color]) => `${key}:${color}`,
          )
          .join(';')}}`,
    )
    .join('\n');
}

/** Update the one owned style element without replacing any working palette on invalid input. */
export function applyCustomAppearance(doc: Document, value: unknown) {
  const css = customAppearanceStyleSheet(value),
    current = doc.getElementById('haushaltsbuch-custom-palette');
  if (!css) {
    if (value === null) current?.remove();
    return;
  }
  const style = current ?? doc.createElement('style');
  style.id = 'haushaltsbuch-custom-palette';
  style.textContent = css;
  if (!current) doc.head.appendChild(style);
}

/** Provide fresh contrast-safe editor defaults without applying them or reading real financial data. */
export function defaultCustomAppearance(): CustomAppearance {
  return {
    light: ['#f6f6fc', '#ffffff', '#1c1d2e', '#545969', '#4935a5', '#ffffff'],
    dark: ['#10131a', '#151822', '#f4f6ff', '#bdc1d1', '#c2b0ff', '#151329'],
  };
}
