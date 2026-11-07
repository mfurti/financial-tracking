import { resolveAppearanceTheme, type AppearanceThemeId } from '../utils/appearance';

/** Share a device-local palette across login, settings and the application shell. */
export function useAppearance() {
  const themeId = useState<AppearanceThemeId>(
    'appearance-palette',
    /** Default is usable even when browser storage is unavailable. */ () => 'default',
  );
  /** Select only a bundled family; mode remains controlled by the independent light/dark preference. */
  function selectTheme(value: unknown) {
    themeId.value = resolveAppearanceTheme(value).id;
  }
  return { themeId, selectTheme };
}
