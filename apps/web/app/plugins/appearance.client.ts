import {
  appearanceStorageKey,
  ayuStorageKey,
  resolveAppearanceTheme,
  resolveAyuPreference,
  applyCustomAppearance,
} from '../utils/appearance';
import { loadWorkspacePreferences, storeWorkspacePreferences } from '../utils/workspace-preferences';

export default defineNuxtPlugin(
  /** Bind the early-restored palette to reactive settings without server persistence. */ () => {
    const { preferences, storageState } = useWorkspacePreferences();
    const restored = loadWorkspacePreferences({
      getItem: /** Access the browser getter inside the guarded storage boundary. */ (key) => localStorage.getItem(key),
    });
    preferences.value = restored.value;
    storageState.value = restored.status;
    useHead({
      htmlAttrs: {
        lang: computed(
          /** Keep client navigation consistent with the early restored locale. */ () => preferences.value.language,
        ),
        'data-amounts-masked': computed(
          /** Expose only the display preference, never financial values. */ () =>
            String(preferences.value.maskAmounts),
        ),
      },
    });
    watch(
      preferences,
      /** Explicit edits may persist; restore alone never overwrites corrupt or newer stored state. */ (value) => {
        storageState.value = storeWorkspacePreferences(
          {
            setItem: /** Let blocked storage retain the usable in-memory preference. */ (key, entry) =>
              localStorage.setItem(key, entry),
          },
          value,
        )
          ? 'ready'
          : 'unavailable';
      },
      { deep: true },
    );
    const { themeId, ayu } = useAppearance();
    themeId.value = resolveAppearanceTheme(document.documentElement.dataset.theme, preferences.value.custom).id;
    watch(
      /** Revalidate restored or explicitly saved pairs before updating the one owned style element. */ () =>
        preferences.value.custom,
      /** Invalid edits never reach preferences; explicit removal restores the bundled default. */ (value) => {
        applyCustomAppearance(document, value);
        if (themeId.value === 'custom' && !value) themeId.value = 'default';
      },
      { immediate: true, deep: true },
    );
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
        const id = resolveAppearanceTheme(value, preferences.value.custom).id;
        document.documentElement.dataset.theme = id;
        if (id === 'custom' && storageState.value === 'unavailable') return;
        try {
          localStorage.setItem(appearanceStorageKey, id);
        } catch {
          /* Device storage can be disabled by the browser. */
        }
      },
    );
  },
);
