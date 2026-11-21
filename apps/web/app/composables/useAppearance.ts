import {
  appearanceChoices,
  resolveAppearanceTheme,
  type AppearanceThemeId,
  type AyuPreference,
} from '../utils/appearance';

/** Share a device-local palette across login, settings and the application shell. */
export function useAppearance() {
  const themeId = useState<AppearanceThemeId>(
    'appearance-palette',
    /** Default is usable even when browser storage is unavailable. */ () => 'default',
  );
  const ayu = useState<AyuPreference>(
    'appearance-ayu',
    /** Keep the original palette for existing users. */ () => ({ tone: 'dark', bordered: true }),
  );
  const mode = useColorMode();
  const { preferences } = useWorkspacePreferences();
  /** Select a bundled family or Ayu variant, retaining the most recently chosen dark tone. */
  function selectTheme(value: unknown) {
    const choice = appearanceChoices.find(
      /** Ignore arbitrary values from storage or events. */ (entry) => entry.value === value,
    );
    if (value === 'custom' && !preferences.value.custom) return;
    themeId.value = choice?.family ?? resolveAppearanceTheme(value, preferences.value.custom).id;
    if (choice?.ayu) {
      ayu.value = { tone: choice.mode === 'light' ? ayu.value.tone : choice.ayu.tone, bordered: choice.ayu.bordered };
      mode.preference = choice.mode!;
    }
  }
  const selectedChoice = computed(
    /** Match the visible selection after either a tile or circle change. */ () =>
      themeId.value !== 'ayu'
        ? themeId.value
        : `ayu-${mode.value === 'dark' ? ayu.value.tone : 'light'}${ayu.value.bordered ? '' : '-borderless'}`,
  );
  return { themeId, ayu, selectedChoice, selectTheme };
}
