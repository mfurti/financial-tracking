<script setup lang="ts">
import { appearanceChoices, choiceTone } from '../utils/appearance';
const { selectedChoice, selectTheme } = useAppearance();
const mode = useColorMode();
const { preferences } = useWorkspacePreferences();
const choices = computed(
  /** Render previews in the active brightness unless an Ayu tile fixes it. */ () =>
    [
      ...appearanceChoices,
      ...(preferences.value.custom ? [{ value: 'custom', label: tr('Eigene Farben'), family: 'custom' as const }] : []),
    ].map(
      /** Preview uses exactly the application's palette. */ (choice) => ({
        ...choice,
        label: choice.family === 'ayu' ? choice.label.replace('Ohne Rahmen', tr('Ohne Rahmen')) : tr(choice.label),
        tone: choiceTone(choice, mode.value === 'dark' ? 'dark' : 'light', preferences.value.custom),
      }),
    ),
);
</script>

<template>
  <SectionPanel :title="tr('Farben & Darstellung')" icon="settings" class="mb-6">
    <HelpPopover
      :title="tr('Theme-Auswahl')"
      :text="
        tr(
          'Hell und Dunkel wechselst du über den Kreis. Ayu bietet sechs Varianten. Deine Auswahl wird auf diesem Gerät gespeichert.',
        )
      "
      class="mb-4"
    />
    <UFormField :label="tr('Helligkeit')" class="mb-5 max-w-sm">
      <ChoiceSelect
        v-model="mode.preference"
        :aria-label="tr('Helligkeit')"
        :searchable="false"
        :items="[
          { label: tr('Wie mein Gerät'), value: 'system' },
          { label: tr('Hell'), value: 'light' },
          { label: tr('Dunkel'), value: 'dark' },
        ]"
      />
    </UFormField>
    <URadioGroup
      :model-value="selectedChoice"
      :items="choices"
      :legend="tr('Farbthema')"
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
          <span class="theme-preview-card"
            ><small>{{ tr('Monatsbilanz') }}</small
            ><strong>{{ amountsMasked() ? tr('Betrag ausgeblendet') : `+ ${money('42000')}` }}</strong></span
          >
          <span class="theme-preview-chart"><i /><i /><i /><i /></span>
          <span class="theme-preview-caption">{{ tr('Ausgaben im Überblick') }}</span>
        </span>
      </template>
    </URadioGroup>
    <UButton to="/settings/appearance/custom" variant="soft" class="mt-5">{{ tr('Eigene Farben bearbeiten') }}</UButton>
  </SectionPanel>
</template>
