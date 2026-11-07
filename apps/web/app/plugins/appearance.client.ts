import { appearanceStorageKey, resolveAppearanceTheme } from '../utils/appearance';

export default defineNuxtPlugin(
  /** Bind the early-restored palette to reactive settings without server persistence. */ () => {
    const { themeId } = useAppearance();
    themeId.value = resolveAppearanceTheme(document.documentElement.dataset.theme).id;
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
