<script setup lang="ts">
import { appearanceChoices, choiceTone } from '../utils/appearance';
const { selectedChoice, selectTheme } = useAppearance();
const mode = useColorMode();
const { preferences } = useWorkspacePreferences();
const choices = computed(
  /** Render previews in the active brightness unless an Ayu tile fixes it. */ () =>
    [
      ...appearanceChoices,
      ...(preferences.value.custom ? [{ value: 'custom', label: 'Eigene Farben', family: 'custom' as const }] : []),
    ].map(
      /** Preview uses exactly the application's palette. */ (choice) => ({
        ...choice,
        tone: choiceTone(choice, mode.value === 'dark' ? 'dark' : 'light', preferences.value.custom),
      }),
    ),
);
</script>

<template>
  <SectionPanel title="Farben & Darstellung" icon="settings" class="mb-6">
    <HelpPopover
      title="Theme-Auswahl"
      text="Hell und Dunkel wechselst du über den Kreis. Ayu bietet sechs Varianten. Deine Auswahl wird auf diesem Gerät gespeichert."
      class="mb-4"
    />
    <UFormField label="Helligkeit" class="mb-5 max-w-sm">
      <ChoiceSelect
        v-model="mode.preference"
        aria-label="Helligkeit"
        :searchable="false"
        :items="[
          { label: 'Wie mein Gerät', value: 'system' },
          { label: 'Hell', value: 'light' },
          { label: 'Dunkel', value: 'dark' },
        ]"
      />
    </UFormField>
    <URadioGroup
      :model-value="selectedChoice"
      :items="choices"
      legend="Farbthema"
      variant="card"
      :ui="{ fieldset: 'theme-tiles', item: 'theme-tile', wrapper: 'min-w-0 flex-1' }"
      @update:model-value="selectTheme"
    >
      <template #label="{ item }">
        <span class="theme-tile-label">{{ item.label }}</span>
      </template>
      <template #description="{ item }">
        <span
          class="theme-finance-preview"
          :style="{
            background: item.tone[0],
            color: item.tone[2],
            '--preview-surface': item.tone[1],
            '--preview-accent': item.tone[4],
            '--preview-muted': item.tone[3],
            '--preview-border': item.ayu?.bordered === false ? 'transparent' : item.tone[3],
          }"
          aria-hidden="true"
        >
          <span class="theme-preview-card"><small>Monatsbilanz</small><strong>+ 420,00 €</strong></span>
          <span class="theme-preview-chart"><i /><i /><i /><i /></span>
          <span class="theme-preview-caption">Ausgaben im Überblick</span>
        </span>
      </template>
    </URadioGroup>
    <UButton to="/settings/appearance/custom" variant="soft" class="mt-5">Eigene Farben bearbeiten</UButton>
  </SectionPanel>
</template>
