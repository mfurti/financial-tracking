<script setup lang="ts">
import { appearanceThemes, resolveAppearanceTheme } from '../utils/appearance';
const { themeId, selectTheme } = useAppearance();
const mode = useColorMode();
const selected = computed(/** Preview the resolved bundled palette. */ () => resolveAppearanceTheme(themeId.value));
const tone = computed(
  /** Follow the same resolved mode as the circular header control. */ () =>
    selected.value[mode.value === 'dark' ? 'dark' : 'light'],
);
</script>

<template>
  <section class="panel mb-6" aria-labelledby="appearance-heading">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">SO FÜHLT SICH DEIN HAUSHALTSBUCH AN</p>
        <h2 id="appearance-heading">Farben & Darstellung</h2>
      </div>
    </div>
    <p class="muted mb-5">
      Wähle deine Farbwelt. Hell und Dunkel wechselst du über den Kreis. Deine Auswahl bleibt auf diesem Gerät
      gespeichert.
    </p>
    <div class="form-row">
      <label
        >Farbthema<ChoiceSelect
          :model-value="themeId"
          aria-label="Farbthema"
          :searchable="true"
          :items="[
            ...appearanceThemes.map(
              /** Build a persisted choice. */ (theme) => ({ label: `${theme.name}`, value: theme.id }),
            ),
          ]"
          @update:model-value="selectTheme($event)"
        /><span class="field-help"
          >{{ appearanceThemes.length }} Farbwelten, angelehnt an bekannte VS-Code-Themes und für diese App
          angepasst.</span
        ></label
      >
      <label
        >Helligkeit<ChoiceSelect
          v-model="mode.preference"
          aria-label="Helligkeit"
          :searchable="false"
          :items="[
            { label: `Wie mein Gerät`, value: 'system' },
            { label: `Hell`, value: 'light' },
            { label: `Dunkel`, value: 'dark' },
          ]"
        /><span class="field-help">„Wie mein Gerät“ folgt deiner Systemeinstellung.</span></label
      >
    </div>
    <div class="appearance-preview" :style="{ background: tone[0], color: tone[2] }" aria-label="Theme-Vorschau">
      <div :style="{ background: tone[1] }">
        <span :style="{ background: tone[4] }" /><strong>{{ selected.name }}</strong
        ><small :style="{ color: tone[3] }"
          >{{ mode.value === 'dark' ? 'Dunkel' : 'Hell' }} · Vorschau deiner Farbwelt</small
        >
      </div>
    </div>
  </section>
</template>
