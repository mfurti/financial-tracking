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
export type AppearanceThemeId = (typeof appearanceThemes)[number]['id'];

/** Invalid or missing stored preferences fall back to the default family. */
export function resolveAppearanceTheme(value: unknown) {
  return (
    appearanceThemes.find(/** Accept only a bundled family. */ (theme) => theme.id === value) ?? appearanceThemes[0]
  );
}

/** Map an adapted tone to shared page/component tokens, with financial colors independent of branding. */
export function appearanceVariables(theme: AppearanceTheme, mode: 'light' | 'dark'): Record<string, string> {
  const [canvas, surface, ink, muted, accent, onAccent] = theme[mode];
  const contrast = theme.id === 'high-contrast';
  const line = contrast ? (mode === 'dark' ? '#ffffff' : '#000000') : `color-mix(in srgb, ${ink} 14%, ${surface})`;
  const soft = `color-mix(in srgb, ${accent} 7%, ${surface})`;
  return {
    '--canvas': canvas,
    '--surface': surface,
    '--soft': soft,
    '--ink': ink,
    '--muted': muted,
    '--line': line,
    '--control-border': contrast ? line : `color-mix(in srgb, ${ink} 48%, ${surface})`,
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
    '--chart-2': '#10b7a2',
    '--chart-3': '#e4a652',
    '--chart-4': '#e4829b',
    '--chart-5': '#6a9bdb',
    '--chart-6': '#9b91ad',
  };
}

/** Emit static palette CSS at build time so a restored preference is available before the app mounts. */
export function appearanceStyleSheet() {
  return appearanceThemes
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
}

/** Restore only an allowlisted family before first paint; storage denial keeps the default usable. */
export function appearanceBootstrap() {
  const ids = JSON.stringify(
    appearanceThemes.map(/** Stored values cannot introduce new styles. */ (theme) => theme.id),
  );
  return `(()=>{let id='default';try{const value=localStorage.getItem('${appearanceStorageKey}');if(${ids}.includes(value))id=value;}catch{}document.documentElement.dataset.theme=id;})();`;
}
