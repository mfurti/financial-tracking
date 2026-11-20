<script setup lang="ts">
import { defaultCustomAppearance, resolveCustomAppearance } from '../../../utils/appearance';
const { preferences, storageState, updatePreferences } = useWorkspacePreferences();
const { selectTheme } = useAppearance();
const initial = preferences.value.custom ?? defaultCustomAppearance();
const form = reactive({ light: [...initial.light], dark: [...initial.dark] });
const error = ref(''),
  notice = ref('');
const formId = useId();
const modes = [
  { id: 'light', label: 'Helle Darstellung' },
  { id: 'dark', label: 'Dunkle Darstellung' },
] as const;
const labels = ['Hintergrund', 'Kartenfläche', 'Text', 'Sekundärer Text', 'Akzent', 'Text auf Akzent'];
/** Accept only opaque six-digit hex in swatches, never raw draft CSS. */
function swatch(value: string | undefined) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : 'transparent';
}
/** Validate both complete tones before replacing any working palette or persisted choice. */
async function save() {
  error.value = '';
  notice.value = '';
  for (const mode of modes)
    for (let index = 0; index < 6; index++) {
      if (!/^#[0-9a-f]{6}$/i.test(form[mode.id][index]!)) {
        error.value = 'Vollständige Hex-Farbe mit sechs Stellen eingeben, zum Beispiel #4935a5.';
        await nextTick();
        document.getElementById(`${formId}-${mode.id}-${index}`)?.focus();
        return;
      }
    }
  const pair = resolveCustomAppearance(form);
  if (!pair) {
    error.value =
      'Kontrast reicht nicht aus: normaler Text mindestens 4,5:1; große Schrift und Bedienelemente mindestens 3:1. Helle und dunkle Farben prüfen.';
    const mode = resolveCustomAppearance({ ...defaultCustomAppearance(), light: form.light }) ? 'dark' : 'light';
    await nextTick();
    document.getElementById(`${formId}-${mode}-2`)?.focus();
    return;
  }
  if (!updatePreferences({ custom: pair })) {
    error.value = 'Farben konnten nicht übernommen werden. Das bisherige Theme bleibt aktiv.';
    return;
  }
  selectTheme('custom');
  notice.value = 'Eigene Farben für Hell und Dunkel übernommen.';
}
/** Reset only the unsaved editor draft; the active saved palette changes only after explicit validation/save. */
function resetDraft() {
  const defaults = defaultCustomAppearance();
  form.light = [...defaults.light];
  form.dark = [...defaults.dark];
  error.value = '';
  notice.value = '';
}
</script>
<template>
  <UButton to="/settings/appearance" variant="link">Zurück zu Darstellung</UButton>
  <div class="page-heading"><h1>Eigene Farben</h1></div>
  <p class="custom-intro">
    Beide Helligkeiten werden gemeinsam geprüft. Normaler Text benötigt mindestens 4,5:1, große Schrift und
    Bedienelemente mindestens 3:1 Kontrast. Finanzfarben, Fokus und Diagramme bleiben lesbar; ungültige Eingaben
    ersetzen kein funktionierendes Theme.
  </p>
  <p v-if="error" role="alert">{{ error }}</p>
  <p v-if="notice" role="status">{{ notice }}</p>
  <p v-if="storageState !== 'ready'" role="status">
    Gerätespeicher nicht verfügbar oder ungültig. Farben bleiben gegebenenfalls nur für diese Sitzung erhalten.
  </p>
  <form @submit.prevent="save">
    <div class="custom-tone-grid">
      <SectionPanel v-for="mode in modes" :key="mode.id" :title="mode.label"
        ><div class="custom-tone-fields">
          <label v-for="(label, index) in labels" :key="label" :for="`${formId}-${mode.id}-${index}`"
            ><span>{{ label }}</span
            ><span class="custom-color-input"
              ><span
                class="custom-swatch"
                :style="{ background: swatch(form[mode.id][index]) }"
                aria-hidden="true" /><input
                :id="`${formId}-${mode.id}-${index}`"
                v-model="form[mode.id][index]"
                :aria-label="`${mode.label}: ${label}`"
                maxlength="7"
                autocomplete="off"
                spellcheck="false"
                placeholder="#4935a5" /></span
          ></label>
        </div>
        <div
          class="custom-preview"
          :style="{
            background: swatch(form[mode.id][0]),
            color: swatch(form[mode.id][2]),
            borderColor: swatch(form[mode.id][3]),
          }"
          aria-hidden="true"
        >
          <strong>Farbvorschau</strong>
          <p :style="{ color: swatch(form[mode.id][3]) }">Beispieltext zur Lesbarkeit</p>
          <span :style="{ background: swatch(form[mode.id][4]), color: swatch(form[mode.id][5]) }">Beispielaktion</span>
        </div></SectionPanel
      >
    </div>
    <div class="custom-actions">
      <UButton type="submit">Eigene Farben übernehmen</UButton
      ><UButton type="button" variant="soft" @click="resetDraft">Entwurf zurücksetzen</UButton>
    </div>
  </form>
</template>
<style scoped>
.custom-intro {
  max-width: 90ch;
  margin-bottom: 24px;
}
.custom-tone-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}
.custom-tone-grid > * {
  min-width: 0;
}
.custom-tone-fields {
  display: grid;
  gap: 14px;
}
.custom-tone-fields label {
  display: grid;
  gap: 6px;
}
.custom-color-input {
  display: flex;
  align-items: center;
  gap: 10px;
}
.custom-swatch {
  width: 32px;
  height: 32px;
  border: 1px solid var(--control-border);
  border-radius: 6px;
  flex: none;
}
input {
  width: 100%;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--control-border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
}
.custom-preview {
  margin-top: 20px;
  padding: 16px;
  border: 1px solid;
  border-radius: 12px;
}
.custom-preview span {
  display: inline-block;
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 6px;
}
.custom-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-block: 24px;
}
@media (max-width: 700px) {
  .custom-tone-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
