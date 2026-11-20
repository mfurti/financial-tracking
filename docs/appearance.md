# Application appearance

The integrated settings hub links to `/settings/appearance` for the existing palette/brightness controls. Profile, account groups and password use separate sibling routes; the password page reuses current-password verification and revokes all sessions after a successful change. Device privacy and notification-kind choices remain local. Notification visibility filters affect the list without changing server-side read receipts or financial sources.

> **Catalog update, 2026-11-08:** Appearance controls are implemented, not an open theme task. Remaining product/UI acceptance: [status.md](status.md), R1–R3/E6 in [todo.md](todo.md).

Settings offers 23 device-local preview tiles based on 18 adapted color families. Ordinary families retain an independent system/light/dark preference. The six Ayu tiles explicitly select Light, Dark or Mirage, each bordered/unbordered; selecting a tile activates its brightness. The circular header/login button preserves Ayu border choice and switches Light with the last selected Dark/Mirage variant. Existing stored preferences remain valid.

The catalog in apps/web/app/utils/appearance.ts contains 18 adapted families: Haushaltsbuch, VS Code Modern, GitHub, One Dark Pro, Dracula, Nord, Monokai, Solarized, Catppuccin, Tokyo Night, Gruvbox, Night Owl, Material, Ayu, Rosé Pine, Cobalt2, SynthWave '84 and high contrast. These are app palettes inspired by editor themes, not installed VS Code extensions. Paired light variants are adapted when necessary; they are not advertised as original editor variants.

Primary references: [VS Code theme documentation](https://code.visualstudio.com/docs/configure/themes), [default theme source](https://github.com/microsoft/vscode/tree/main/extensions/theme-defaults), [Dracula specification](https://draculatheme.com/spec), [Nord palettes](https://www.nordtheme.com/docs/colors-and-palettes/) and [Catppuccin palette](https://catppuccin.com/palette/). Individual app tones are selected for readable controls and financial displays rather than syntax-highlighting fidelity. No third-party extension is downloaded or executed by the app.

Nuxt emits static semantic-token CSS into the page head. The small early script reads only haushaltsbuch-palette and accepts bundled IDs; invalid/missing/blocked storage falls back to default. A client plugin connects Settings to that preference. Nuxt's existing haushaltsbuch-theme key continues to own brightness. Neither preference contains bank, session or financial data.

Tests measure foreground/secondary/action/button/financial text contrast for both modes of every family, execute the real bootstrap with allowed/invalid/blocked storage and exercise the actual browser controls, reload, logout, keyboard and reduced motion. Final UI checks still need to cover layout, focus and component states; static palette ratios alone are not full accessibility proof.
