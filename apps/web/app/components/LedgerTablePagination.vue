<script setup lang="ts">
defineProps<{ perPage: number; total: number }>();
const emit = defineEmits<{ 'page-size': [value: number] }>();
const page = defineModel<number>('page', { required: true });
const sizes = [10, 25, 50, 100].map(
  /** Expose intentional bounded sizes for reading the ledger. */ (value) => ({
    label: String(value),
    value: String(value),
  }),
);
const texts = { pagination: { summary: tr('{start}–{end} von {total}') } };
</script>

<template>
  <QTablePagination
    v-model:page="page"
    :items-per-page="perPage"
    :total-items="total"
    :shortcuts="false"
    :texts="texts"
  >
    <template #page-size>
      <ChoiceSelect
        :model-value="String(perPage)"
        :items="sizes"
        :aria-label="tr('Einträge pro Seite')"
        :searchable="false"
        @update:model-value="emit('page-size', Number($event))"
      />
    </template>
  </QTablePagination>
</template>
