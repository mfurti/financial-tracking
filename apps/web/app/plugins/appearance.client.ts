import { appearanceStorageKey, ayuStorageKey, resolveAppearanceTheme, resolveAyuPreference } from '../utils/appearance';

export default defineNuxtPlugin(
  /** Bind the early-restored palette to reactive settings without server persistence. */ () => {
    const { themeId, ayu } = useAppearance();
    themeId.value = resolveAppearanceTheme(document.documentElement.dataset.theme).id;
    ayu.value = resolveAyuPreference({
      tone: document.documentElement.dataset.ayuTone,
      bordered: document.documentElement.dataset.ayuBorder !== 'none',
    });
    watch(
      ayu,
      /** Apply a validated Ayu preference without losing its last dark tone. */ (value) => {
        const preference = resolveAyuPreference(value);
        document.documentElement.dataset.ayuTone = preference.tone;
        document.documentElement.dataset.ayuBorder = preference.bordered ? 'visible' : 'none';
        try {
          localStorage.setItem(ayuStorageKey, JSON.stringify(preference));
        } catch {
          /* Storage denial must not block controls. */
        }
      },
      { deep: true },
    );
    watch(
      themeId,
      /** Apply and persist a valid family without breaking the app when storage is blocked. */ (value) => {
        const id = resolveAppearanceTheme(value).id;
        document.documentElement.dataset.theme = id;
        try {
          localStorage.setItem(appearanceStorageKey, id);
        } catch {
          /* Device storage can be disabled by the browser. */
        }
      },
    );
  },
);
