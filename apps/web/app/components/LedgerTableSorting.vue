<script setup lang="ts">
import type { SortingField, SortingRule } from '@querry-kit/nuxt/types';

defineProps<{ fields: SortingField[] }>();
const sorting = defineModel<SortingRule[]>({ required: true });
const texts = {
  sorting: {
    title: tr('Sortieren'),
    field: tr('Sortierfeld wählen'),
    add: tr('Sortierung hinzufügen'),
    clear: tr('Sortierung zurücksetzen'),
    remove: tr('Sortierung entfernen'),
    toggle: tr('Sortierrichtung wechseln'),
  },
};
</script>

<template>
  <QTableToolbar v-model:sorting="sorting" :sortable-fields="fields" :shortcuts="false" :texts="texts" />
</template>
